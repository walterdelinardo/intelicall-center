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

// Map Evolution messageType field ("audioMessage") to short type ("audio")
const MESSAGE_TYPE_MAP: Record<string, string> = {
  audioMessage: 'audio',
  imageMessage: 'image',
  videoMessage: 'video',
  documentMessage: 'document',
  stickerMessage: 'sticker',
  conversation: 'text',
  extendedTextMessage: 'text',
};

// Placeholder text per media type
const PLACEHOLDER_MAP: Record<string, string> = {
  audio: '[Áudio]',
  image: '[Imagem]',
  video: '[Vídeo]',
  document: '[Documento]',
  sticker: '[Sticker]',
};

function normalizePayload(payload: any): NormalizedPayload | null {
  // Resolve structure: payload is { raw: { event, instance, data } }
  const raw = payload.raw || payload;
  const data = raw.data || raw;

  // 1. Event & instance
  const event = raw.event || data.event || '';
  const instanceName = raw.instance || data.instance || data.instance_name || '';

  // 2. Clinic ID (may come from legacy formats)
  const clinicId = data.clinic_id || data.clinicId || null;

  // 3. Key fields
  const key = data.key || {};
  const remoteJid = key.remoteJid || data.remote_jid || '';
  const isFromMe = !!(key.fromMe ?? data.from_me ?? false);
  const messageId = key.id || data.message_id || crypto.randomUUID();

  // 4. Contact name
  const contactName = data.pushName || data.push_name || data.senderName || '';

  // 5. Timestamp
  const ts = data.messageTimestamp || data.timestamp;
  const messageTimestamp = ts ? Number(ts) : null;

  // 6. Message type — map from Evolution "audioMessage" → "audio"
  const rawMessageType = data.messageType || '';
  let messageType = MESSAGE_TYPE_MAP[rawMessageType] || rawMessageType || 'text';

  // 7. Extract media metadata from nested message object
  const msg = data.message || {};
  const mediaObj = msg[rawMessageType] || {};

  let mediaUrl: string | null = mediaObj.url || data.mediaUrl || null;
  let mimeType: string | null = mediaObj.mimetype || null;
  let caption: string | null = mediaObj.caption || null;
  let fileName: string | null = mediaObj.fileName || null;
  let mediaSeconds: number | null = mediaObj.seconds != null ? Number(mediaObj.seconds) : null;
  let mediaWidth: number | null = mediaObj.width != null ? Number(mediaObj.width) : null;
  let mediaHeight: number | null = mediaObj.height != null ? Number(mediaObj.height) : null;
  let thumbnailBase64: string | null = mediaObj.jpegThumbnail || null;

  // 8. Base64 — Evolution puts it at data.base64 (top of data object)
  let base64: string | null = data.base64 || mediaObj.base64 || null;

  // 9. Media type (short)
  let mediaType: string | null = messageType !== 'text' ? messageType : null;

  // 10. Content — for text messages, extract from message object; for media, use caption or placeholder
  let content = '';
  if (messageType === 'text') {
    content = msg.conversation || msg.extendedTextMessage?.text || data.body || '';
  } else {
    content = caption || PLACEHOLDER_MAP[messageType] || '[Sem conteúdo]';
  }

  // 11. Fallback: if messageType is still 'text' but we didn't get content, try detecting from message keys
  if (!content && messageType === 'text') {
    for (const [evoType, shortType] of Object.entries(MESSAGE_TYPE_MAP)) {
      if (msg[evoType] && shortType !== 'text') {
        messageType = shortType;
        mediaType = shortType;
        const fallbackObj = msg[evoType];
        mediaUrl = mediaUrl || fallbackObj.url || null;
        mimeType = mimeType || fallbackObj.mimetype || null;
        caption = caption || fallbackObj.caption || null;
        fileName = fileName || fallbackObj.fileName || null;
        mediaSeconds = mediaSeconds ?? (fallbackObj.seconds != null ? Number(fallbackObj.seconds) : null);
        base64 = base64 || fallbackObj.base64 || null;
        content = caption || PLACEHOLDER_MAP[shortType] || '[Sem conteúdo]';
        break;
      }
    }
  }

  if (!content) {
    content = data.content || data.body || '';
  }

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
      const rawUp = payload.raw || payload;
      const dataUp = rawUp.data || rawUp;
      const upKey = dataUp.key || {};
      const upMessageId = upKey.id || dataUp.messageId;
      const upStatus = dataUp.update?.status || dataUp.status;

      if (upMessageId && upStatus !== undefined) {
        const statusMap: Record<number, string> = {
          0: 'error', 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read',
        };

        await supabase
          .from('whatsapp_messages')
          .update({ status: statusMap[upStatus] || String(upStatus) })
          .eq('message_id', upMessageId);
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
