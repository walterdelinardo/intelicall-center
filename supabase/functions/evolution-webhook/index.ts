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

async function upsertMessage(supabase: any, messageData: Record<string, any>) {
  const { data: existing } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('message_id', messageData.message_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('whatsapp_messages')
      .update(messageData)
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
  contactName: string;
  messageTimestamp: number | null;
}

function normalizePayload(payload: any): NormalizedPayload | null {
  // The data object may be nested or at root level
  const data = payload.data || payload;

  // 1. Instance name
  const instanceName = payload.instance_name || payload.instance || payload.instanceName
    || data.instance || data.instanceName || '';

  // 2. Event
  const event = payload.event || data.event || '';

  // 3. Clinic ID (optional — resolved later if missing)
  const clinicId = payload.clinic_id || payload.clinicId || data.clinic_id || null;

  // 4. Remote JID — deep fallbacks
  const remoteJid = data.key?.remoteJid || data.remoteJid
    || payload.remoteJid || payload.remote_jid
    || data.data?.key?.remoteJid || '';

  // 5. fromMe
  const isFromMe = data.key?.fromMe ?? data.fromMe ?? payload.fromMe ?? false;

  // 6. Message ID
  const messageId = data.key?.id || data.messageId || data.id
    || payload.messageId || crypto.randomUUID();

  // 7. Content — extract from multiple message shapes
  let content = '';
  let messageType = 'text';
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;

  const msg = data.message || {};

  if (msg.conversation) {
    content = msg.conversation;
  } else if (msg.extendedTextMessage?.text) {
    content = msg.extendedTextMessage.text;
  } else if (msg.imageMessage) {
    messageType = 'image';
    content = msg.imageMessage.caption || '[Imagem]';
    mediaUrl = data.mediaUrl || payload.mediaUrl || null;
    mediaType = 'image';
  } else if (msg.audioMessage) {
    messageType = 'audio';
    content = '[Áudio]';
    mediaUrl = data.mediaUrl || payload.mediaUrl || null;
    mediaType = 'audio';
  } else if (msg.videoMessage) {
    messageType = 'video';
    content = msg.videoMessage.caption || '[Vídeo]';
    mediaUrl = data.mediaUrl || payload.mediaUrl || null;
    mediaType = 'video';
  } else if (msg.documentMessage) {
    messageType = 'document';
    content = msg.documentMessage.fileName || '[Documento]';
    mediaUrl = data.mediaUrl || payload.mediaUrl || null;
    mediaType = 'document';
  }

  // Flattened fallbacks (N8N may send content/body at root)
  if (!content) {
    content = data.body || data.content || payload.body || payload.content || '';
  }

  // 8. Contact / push name
  const contactName = data.pushName || data.senderName || data.sender?.pushName
    || payload.pushName || payload.senderName || '';

  // 9. Timestamp
  const ts = data.messageTimestamp || payload.messageTimestamp || null;
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

    // Debug: log top-level keys
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
      clinicId: normalized.clinicId,
      isFromMe: normalized.isFromMe,
    }));

    // ── Resolve inbox ───────────────────────────────────────────────
    let inboxId: string | null = null;
    let clinicId = normalized.clinicId;

    if (normalized.instanceName) {
      // Try to find existing inbox
      const { data: inbox } = await supabase
        .from('whatsapp_inboxes')
        .select('id, clinic_id')
        .eq('instance_name', normalized.instanceName)
        .eq('is_active', true)
        .maybeSingle();

      if (inbox) {
        inboxId = inbox.id;
        // If clinic_id wasn't in payload, use the one from inbox
        if (!clinicId) {
          clinicId = inbox.clinic_id;
        }
      } else if (clinicId) {
        // Auto-create inbox
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

    if (event === 'messages.upsert' || event === 'message' || event === 'messages.upsert') {
      const { remoteJid, content, messageId, isFromMe, messageType, mediaUrl, mediaType, contactName, messageTimestamp } = normalized;

      if (!remoteJid) {
        console.error('remoteJid is empty after normalization. Full payload:', JSON.stringify(payload).substring(0, 1000));
        return new Response(
          JSON.stringify({ error: 'remoteJid could not be extracted from payload' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const contactPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      const displayName = contactName || contactPhone;
      const isGroup = remoteJid.includes('@g.us');

      // Find or create conversation
      const conv = await findOrCreateConversation(supabase, clinicId, inboxId, remoteJid, {
        contact_name: displayName,
        contact_phone: contactPhone,
        is_group: isGroup,
        last_message: content || '[Sem conteúdo]',
        last_message_at: new Date().toISOString(),
        status: 'active',
      });

      // Upsert message
      const timestamp = messageTimestamp
        ? new Date(messageTimestamp * 1000).toISOString()
        : new Date().toISOString();

      await upsertMessage(supabase, {
        conversation_id: conv.id,
        message_id: messageId,
        content: content || '[Sem conteúdo]',
        message_type: messageType,
        is_from_me: isFromMe,
        sender_name: displayName,
        media_url: mediaUrl,
        media_type: mediaType,
        status: isFromMe ? 'sent' : 'received',
        timestamp,
      });

      // Increment unread if not from me
      if (!isFromMe) {
        await supabase
          .from('whatsapp_conversations')
          .update({ unread_count: (conv.unread_count ?? 0) + 1 })
          .eq('id', conv.id);
      }

      console.log('Message processed — conv:', conv.id, 'inbox:', inboxId, 'jid:', remoteJid);
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
