import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log('Evolution webhook received:', JSON.stringify(payload, null, 2));

    // N8N will forward Evolution API webhook data
    // Expected payload format from N8N:
    // { clinic_id, event, data: { ... } }
    const { clinic_id, event, data } = payload;

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: 'clinic_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
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

      // Upsert conversation
      const { data: conv, error: convError } = await supabase
        .from('whatsapp_conversations')
        .upsert({
          clinic_id,
          remote_jid: remoteJid,
          contact_name: contactName,
          contact_phone: contactPhone,
          is_group: isGroup,
          last_message: content,
          last_message_at: new Date().toISOString(),
          unread_count: isFromMe ? 0 : 1,
          status: 'active',
        }, { onConflict: 'clinic_id,remote_jid' })
        .select('id')
        .single();

      if (convError) {
        console.error('Error upserting conversation:', convError);
        throw convError;
      }

      // Insert message
      const { error: msgError } = await supabase
        .from('whatsapp_messages')
        .upsert({
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
        }, { onConflict: 'message_id' });

      if (msgError) {
        console.error('Error upserting message:', msgError);
        throw msgError;
      }

      // If not from me, increment unread
      if (!isFromMe) {
        await supabase.rpc('increment_unread', { _conversation_id: conv.id }).catch(() => {
          // RPC may not exist yet, just update directly
          supabase
            .from('whatsapp_conversations')
            .update({ unread_count: conv.unread_count ? conv.unread_count + 1 : 1 })
            .eq('id', conv.id);
        });
      }

      console.log('Message processed successfully');
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
