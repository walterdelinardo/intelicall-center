import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Helpers ──────────────────────────────────────────────────────────

async function findOrCreateConversation(
  supabase: any,
  clinicId: string,
  inboxId: string | null,
  remoteJid: string,
  updateData: Record<string, any>
) {
  let query = supabase
    .from('whatsapp_conversations')
    .select('id, unread_count')
    .eq('clinic_id', clinicId)
    .eq('remote_jid', remoteJid);

  if (inboxId) {
    query = query.eq('inbox_id', inboxId);
  } else {
    query = query.is('inbox_id', null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from('whatsapp_conversations')
      .update(updateData)
      .eq('id', existing.id)
      .select('id, unread_count')
      .single();
    if (error) throw error;
    return updated;
  } else {
    const { data: created, error } = await supabase
      .from('whatsapp_conversations')
      .insert({ clinic_id: clinicId, inbox_id: inboxId, remote_jid: remoteJid, ...updateData })
      .select('id, unread_count')
      .single();
    if (error) throw error;
    return created;
  }
}

// Media columns that should never be overwritten with null
const MEDIA_FIELDS = [
  'base64', 'media_url', 'mime_type', 'media_type', 'caption',
  'file_name', 'media_seconds', 'media_width', 'media_height', 'thumbnail_base64',
] as const;

async function upsertMessage(supabase: any, messageData: Record<string, any>) {
  const { data: existing } = await supabase
    .from('whatsapp_messages')
    .select('id, base64, media_url, mime_type, media_type, caption, file_name, media_seconds, media_width, media_height, thumbnail_base64')
    .eq('message_id', messageData.message_id)
    .maybeSingle();

  if (existing) {
    // Preserve existing media fields — only overwrite if new value is non-null
    const merged = { ...messageData };
    for (const field of MEDIA_FIELDS) {
      if (merged[field] == null && existing[field] != null) {
        merged[field] = existing[field];
      }
    }
    const { error } = await supabase
      .from('whatsapp_messages')
      .update(merged)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('whatsapp_messages')
      .insert(messageData);
    if (error) throw error;
  }
}

// ── Payload normalizer ──────────────────────────────────────────────

interface NormalizedPayload {
  clinicId: string | null;
  instanceName: string;
  event: string;
  remoteJid: string;
  isFromMe: boolean;
  messageId: string;
  content: string;
  messageType: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mimeType: string | null;
  caption: string | null;
  fileName: string | null;
  mediaSeconds: number | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  thumbnailBase64: string | null;
  base64: string | null;
  contactName: string;
  messageTimestamp: number | null;
}

function normalizePayload(payload: any): NormalizedPayload | null {
  const data = payload.data || payload;

  // Helper: check payload top-level first (N8N flattened), then data (Evolution raw)
  const p = (snake: string, camel?: string): any => {
    if (payload[snake] !== undefined) return payload[snake];
    if (camel && payload[camel] !== undefined) return payload[camel];
    if (data[snake] !== undefined) return data[snake];
    if (camel && data[camel] !== undefined) return data[camel];
    return undefined;
  };

  // 1. Instance name
  const instanceName = p('instance_name', 'instanceName') || '';

  // 2. Event
  const event = p('event') || '';

  // 3. Clinic ID
  const clinicId = p('clinic_id', 'clinicId') || null;

  // 4. Remote JID — N8N sends as top-level remote_jid
  const remoteJid = p('remote_jid', 'remoteJid')
    || data.key?.remoteJid
    || data.data?.key?.remoteJid || '';

  // 5. fromMe — N8N sends as top-level from_me (boolean)
  const rawFromMe = p('from_me', 'fromMe');
  const isFromMe = rawFromMe ?? data.key?.fromMe ?? false;

  // 6. Message ID — N8N sends as top-level message_id
  const messageId = p('message_id', 'messageId')
    || data.key?.id || data.id
    || crypto.randomUUID();

  // 7. Content & media — extract from top-level (N8N) first, then raw Evolution
  let content = p('content') || '';
  let messageType = p('message_type', 'messageType') || 'text';
  let mediaUrl: string | null = p('media_url', 'mediaUrl') || null;
  let mediaType: string | null = p('media_type', 'mediaType') || null;
  let mimeType: string | null = p('mime_type', 'mimeType') || null;
  let caption: string | null = p('caption') || null;
  let fileName: string | null = p('file_name', 'fileName') || null;
  let mediaSeconds: number | null = p('media_seconds', 'mediaSeconds') != null ? Number(p('media_seconds', 'mediaSeconds')) : null;
  let mediaWidth: number | null = p('media_width', 'mediaWidth') != null ? Number(p('media_width', 'mediaWidth')) : null;
  let mediaHeight: number | null = p('media_height', 'mediaHeight') != null ? Number(p('media_height', 'mediaHeight')) : null;
  let thumbnailBase64: string | null = p('thumbnail_base64', 'thumbnailBase64') || null;
  let base64: string | null = p('base64') || null;

  // Fallback: parse raw Evolution message object (when N8N didn't flatten)
  if (!content || content === '[Imagem]' || content === '[Áudio]' || content === '[Vídeo]') {
    const msg = data.message || {};
    if (msg.conversation) {
      content = msg.conversation;
      messageType = 'text';
    } else if (msg.extendedTextMessage?.text) {
      content = msg.extendedTextMessage.text;
      messageType = 'text';
    } else if (msg.imageMessage) {
      messageType = 'image';
      content = msg.imageMessage.caption || caption || '[Imagem]';
      caption = msg.imageMessage.caption || caption;
      mimeType = mimeType || msg.imageMessage.mimetype || null;
      mediaUrl = mediaUrl || data.mediaUrl || null;
      mediaType = 'image';
    } else if (msg.audioMessage) {
      messageType = 'audio';
      content = '[Áudio]';
      mimeType = mimeType || msg.audioMessage.mimetype || null;
      mediaSeconds = mediaSeconds ?? (msg.audioMessage.seconds ? Number(msg.audioMessage.seconds) : null);
      mediaUrl = mediaUrl || data.mediaUrl || null;
      mediaType = 'audio';
    } else if (msg.videoMessage) {
      messageType = 'video';
      content = msg.videoMessage.caption || caption || '[Vídeo]';
      caption = msg.videoMessage.caption || caption;
      mimeType = mimeType || msg.videoMessage.mimetype || null;
      mediaSeconds = mediaSeconds ?? (msg.videoMessage.seconds ? Number(msg.videoMessage.seconds) : null);
      mediaUrl = mediaUrl || data.mediaUrl || null;
      mediaType = 'video';
    } else if (msg.documentMessage) {
      messageType = 'document';
      fileName = fileName || msg.documentMessage.fileName || null;
      content = fileName || '[Documento]';
      mimeType = mimeType || msg.documentMessage.mimetype || null;
      mediaUrl = mediaUrl || data.mediaUrl || null;
      mediaType = 'document';
    } else if (msg.stickerMessage) {
      messageType = 'sticker';
      content = '[Sticker]';
      mimeType = mimeType || msg.stickerMessage.mimetype || null;
      mediaUrl = mediaUrl || data.mediaUrl || null;
      mediaType = 'sticker';
    }
  }

  // Fallback: extract from Chatwoot-style attachments array
  const attachments = data.attachments || payload.attachments;
  if (Array.isArray(attachments) && attachments.length > 0 && !mediaUrl && !base64) {
    const att = attachments[0];
    mediaUrl = att.data_url || att.url || att.external_url || null;
    mimeType = mimeType || att.content_type || null;
    const fileType = att.file_type || '';
    if (!mediaType && fileType) {
      mediaType = fileType;
      if (messageType === 'text') messageType = fileType;
    }
    fileName = fileName || att.file_name || null;
  }

  // Flattened fallbacks for content
  if (!content) {
    content = data.body || payload.body || '';
  }

  // Set mediaType from messageType if not set
  if (!mediaType && messageType !== 'text') {
    mediaType = messageType;
  }

  // 8. Contact / push name — N8N sends as top-level push_name
  const contactName = p('push_name', 'pushName')
    || data.senderName || data.sender?.pushName || data.sender?.name
    || '';

  // 9. Timestamp — N8N sends as top-level timestamp
  const ts = p('timestamp', 'messageTimestamp');
  const messageTimestamp = ts ? Number(ts) : null;

  return {
    clinicId,
    instanceName,
    event,
    remoteJid,
    isFromMe,
    messageId,
    content,
    messageType,
    mediaUrl,
    mediaType,
    mimeType,
    caption,
    fileName,
    mediaSeconds,
    mediaWidth,
    mediaHeight,
    thumbnailBase64,
    base64,
    contactName,
    messageTimestamp,
  };
}

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.text();
    if (!body) {
      return new Response(
        JSON.stringify({ success: true, message: 'No body provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Webhook received — top-level keys:', Object.keys(payload));
    if (payload.data && typeof payload.data === 'object') {
      console.log('payload.data keys:', Object.keys(payload.data));
    }

    const normalized = normalizePayload(payload);
    if (!normalized) {
      console.error('Failed to normalize payload');
      return new Response(
        JSON.stringify({ error: 'Could not normalize payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Normalized:', JSON.stringify({
      event: normalized.event,
      instanceName: normalized.instanceName,
      remoteJid: normalized.remoteJid,
      content: normalized.content?.substring(0, 80),
      messageType: normalized.messageType,
      mediaType: normalized.mediaType,
      clinicId: normalized.clinicId,
      isFromMe: normalized.isFromMe,
      hasBase64: !!normalized.base64,
      hasMediaUrl: !!normalized.mediaUrl,
      mediaUrl: normalized.mediaUrl?.substring(0, 80) || null,
      mimeType: normalized.mimeType,
      caption: normalized.caption?.substring(0, 40) || null,
    }));

    // ── Resolve inbox ───────────────────────────────────────────────
    let inboxId: string | null = null;
    let clinicId = normalized.clinicId;

    if (normalized.instanceName) {
      const { data: inbox } = await supabase
        .from('whatsapp_inboxes')
        .select('id, clinic_id')
        .eq('instance_name', normalized.instanceName)
        .eq('is_active', true)
        .maybeSingle();

      if (inbox) {
        inboxId = inbox.id;
        if (!clinicId) {
          clinicId = inbox.clinic_id;
        }
      } else if (clinicId) {
        const { data: newInbox } = await supabase
          .from('whatsapp_inboxes')
          .insert({
            clinic_id: clinicId,
            instance_name: normalized.instanceName,
            label: normalized.instanceName,
          })
          .select('id')
          .single();
        inboxId = newInbox?.id || null;
      }
    }

    if (!clinicId) {
      console.error('Could not resolve clinic_id. instanceName:', normalized.instanceName);
      return new Response(
        JSON.stringify({ error: 'clinic_id could not be resolved. Provide clinic_id or a registered instance_name.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ── Handle message events ────────────────────────────────────────
    const event = normalized.event;

    if (event === 'messages.upsert' || event === 'message' || !event) {
      const { remoteJid, content, messageId, isFromMe, messageType, mediaUrl, mediaType,
              mimeType, caption, fileName, mediaSeconds, mediaWidth, mediaHeight,
              thumbnailBase64, base64, contactName, messageTimestamp } = normalized;

      if (!remoteJid) {
        console.error('remoteJid is empty after normalization.');
        return new Response(
          JSON.stringify({ error: 'remoteJid could not be extracted from payload' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const contactPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      const displayName = contactName || contactPhone;
      const isGroup = remoteJid.includes('@g.us');

      // Determine last_message preview text
      const lastMessagePreview = messageType === 'text' ? content
        : messageType === 'image' ? (caption || '📷 Imagem')
        : messageType === 'audio' ? '🎵 Áudio'
        : messageType === 'video' ? (caption || '🎥 Vídeo')
        : messageType === 'document' ? (fileName || '📄 Documento')
        : messageType === 'sticker' ? '🏷️ Sticker'
        : content || '[Sem conteúdo]';

      const conv = await findOrCreateConversation(supabase, clinicId, inboxId, remoteJid, {
        contact_name: displayName,
        contact_phone: contactPhone,
        is_group: isGroup,
        last_message: lastMessagePreview,
        last_message_at: new Date().toISOString(),
        status: 'active',
      });

      const timestamp = messageTimestamp
        ? new Date(messageTimestamp * 1000).toISOString()
        : new Date().toISOString();

      await upsertMessage(supabase, {
        conversation_id: conv.id,
        message_id: messageId,
        content: content || null,
        message_type: messageType,
        is_from_me: isFromMe,
        sender_name: displayName,
        media_url: mediaUrl,
        media_type: mediaType,
        mime_type: mimeType,
        caption: caption,
        file_name: fileName,
        media_seconds: mediaSeconds,
        media_width: mediaWidth,
        media_height: mediaHeight,
        thumbnail_base64: thumbnailBase64,
        base64: base64,
        status: isFromMe ? 'sent' : 'received',
        timestamp,
      });

      if (!isFromMe) {
        await supabase
          .from('whatsapp_conversations')
          .update({ unread_count: (conv.unread_count ?? 0) + 1 })
          .eq('id', conv.id);
      }

      console.log('Message processed — conv:', conv.id, 'type:', messageType, 'inbox:', inboxId);
    }

    // ── Handle status update events ──────────────────────────────────
    if (event === 'messages.update' || event === 'message.update') {
      const data = payload.data || payload;
      const messageId = data.key?.id || data.messageId;
      const status = data.update?.status || data.status;

      if (messageId && status !== undefined) {
        const statusMap: Record<number, string> = {
          0: 'error', 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read',
        };

        await supabase
          .from('whatsapp_messages')
          .update({ status: statusMap[status] || String(status) })
          .eq('message_id', messageId);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
