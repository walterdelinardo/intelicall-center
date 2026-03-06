import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function findOrCreateConversation(
  supabase: any,
  clinicId: string,
  inboxId: string | null,
  remoteJid: string,
  updateData: Record<string, any>
) {
  // Build query to find existing conversation
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
    // UPDATE existing conversation
    const { data: updated, error } = await supabase
      .from('whatsapp_conversations')
      .update(updateData)
      .eq('id', existing.id)
      .select('id, unread_count')
      .single();

    if (error) throw error;
    return updated;
  } else {
    // INSERT new conversation
    const insertData = {
      clinic_id: clinicId,
      inbox_id: inboxId,
      remote_jid: remoteJid,
      ...updateData,
    };
    const { data: created, error } = await supabase
      .from('whatsapp_conversations')
      .insert(insertData)
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

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    console.log('Evolution webhook received:', JSON.stringify(payload, null, 2));

    const { clinic_id, instance_name, event, data } = payload;

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: 'clinic_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Resolve inbox_id from instance_name + clinic_id
    let inboxId: string | null = null;
    if (instance_name) {
      const { data: inbox } = await supabase
        .from('whatsapp_inboxes')
        .select('id')
        .eq('clinic_id', clinic_id)
        .eq('instance_name', instance_name)
        .eq('is_active', true)
        .single();

      if (inbox) {
        inboxId = inbox.id;
      } else {
        // Auto-create inbox for this instance
        const { data: newInbox } = await supabase
          .from('whatsapp_inboxes')
          .insert({
            clinic_id,
            instance_name,
            label: instance_name,
          })
          .select('id')
          .single();
        inboxId = newInbox?.id || null;
      }
    }

    // Handle incoming message
    if (event === 'messages.upsert' || event === 'message') {
      const remoteJid = data.key?.remoteJid || data.remoteJid || '';
      const isFromMe = data.key?.fromMe || data.fromMe || false;
      const messageId = data.key?.id || data.messageId || crypto.randomUUID();

      // Extract message content
      let content = '';
      let messageType = 'text';
      let mediaUrl = null;
      let mediaType = null;

      if (data.message?.conversation) {
        content = data.message.conversation;
      } else if (data.message?.extendedTextMessage?.text) {
        content = data.message.extendedTextMessage.text;
      } else if (data.message?.imageMessage) {
        messageType = 'image';
        content = data.message.imageMessage.caption || '[Imagem]';
        mediaUrl = data.mediaUrl;
        mediaType = 'image';
      } else if (data.message?.audioMessage) {
        messageType = 'audio';
        content = '[Áudio]';
        mediaType = 'audio';
      } else if (data.message?.videoMessage) {
        messageType = 'video';
        content = data.message.videoMessage.caption || '[Vídeo]';
        mediaUrl = data.mediaUrl;
        mediaType = 'video';
      } else if (data.message?.documentMessage) {
        messageType = 'document';
        content = data.message.documentMessage.fileName || '[Documento]';
        mediaUrl = data.mediaUrl;
        mediaType = 'document';
      } else if (data.content) {
        content = data.content;
      }

      // Extract contact info
      const contactPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      const contactName = data.pushName || data.senderName || contactPhone;
      const isGroup = remoteJid.includes('@g.us');

      // Find or create conversation (no upsert)
      const conv = await findOrCreateConversation(supabase, clinic_id, inboxId, remoteJid, {
        contact_name: contactName,
        contact_phone: contactPhone,
        is_group: isGroup,
        last_message: content,
        last_message_at: new Date().toISOString(),
        status: 'active',
      });

      // Insert or update message (no upsert)
      await upsertMessage(supabase, {
        conversation_id: conv.id,
        message_id: messageId,
        content,
        message_type: messageType,
        is_from_me: isFromMe,
        sender_name: contactName,
        media_url: mediaUrl,
        media_type: mediaType,
        status: isFromMe ? 'sent' : 'received',
        timestamp: data.messageTimestamp
          ? new Date(Number(data.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString(),
      });

      // If not from me, increment unread count
      if (!isFromMe) {
        await supabase
          .from('whatsapp_conversations')
          .update({ unread_count: (conv.unread_count ?? 0) + 1 })
          .eq('id', conv.id);
      }

      console.log('Message processed successfully for inbox:', inboxId);
    }

    // Handle status updates
    if (event === 'messages.update' || event === 'message.update') {
      const messageId = data.key?.id || data.messageId;
      const status = data.update?.status || data.status;

      if (messageId && status) {
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
