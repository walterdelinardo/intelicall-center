import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionUrl || !evolutionKey) {
      throw new Error('Evolution API credentials not configured');
    }

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub as string;

    const { remoteJid, message, messageType = 'text', mediaUrl, inboxId } = await req.json();

    if (!remoteJid || !message) {
      return new Response(
        JSON.stringify({ error: 'remoteJid and message are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Determine instance name: from inbox or fallback to env
    let instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || '';

    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (inboxId) {
      const { data: inbox } = await supabaseService
        .from('whatsapp_inboxes')
        .select('instance_name')
        .eq('id', inboxId)
        .single();
      if (inbox) {
        instanceName = inbox.instance_name;
      }
    }

    if (!instanceName) {
      throw new Error('No Evolution instance configured');
    }

    // Send message via Evolution API
    let endpoint = `${evolutionUrl}/message/sendText/${instanceName}`;
    let body: any = {
      number: remoteJid.replace('@s.whatsapp.net', ''),
      text: message,
    };

    if (messageType === 'image' && mediaUrl) {
      endpoint = `${evolutionUrl}/message/sendMedia/${instanceName}`;
      body = {
        number: remoteJid.replace('@s.whatsapp.net', ''),
        mediatype: 'image',
        media: mediaUrl,
        caption: message,
      };
    } else if (messageType === 'document' && mediaUrl) {
      endpoint = `${evolutionUrl}/message/sendMedia/${instanceName}`;
      body = {
        number: remoteJid.replace('@s.whatsapp.net', ''),
        mediatype: 'document',
        media: mediaUrl,
        caption: message,
      };
    } else if (messageType === 'audio' && mediaUrl) {
      endpoint = `${evolutionUrl}/message/sendWhatsAppAudio/${instanceName}`;
      body = {
        number: remoteJid.replace('@s.whatsapp.net', ''),
        audio: mediaUrl,
      };
    }

    console.log('Sending to Evolution API:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionKey,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Evolution API error:', result);
      throw new Error(`Evolution API error [${response.status}]: ${JSON.stringify(result)}`);
    }

    console.log('Message sent successfully:', result);

    // Store sent message in DB
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('clinic_id')
      .eq('id', userId)
      .single();

    if (profile?.clinic_id) {
      // Build conversation upsert
      const convData: Record<string, any> = {
        clinic_id: profile.clinic_id,
        remote_jid: remoteJid,
        last_message: message,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        status: 'active',
      };
      if (inboxId) {
        convData.inbox_id = inboxId;
      }

      const { data: conv } = await supabaseService
        .from('whatsapp_conversations')
        .upsert(convData, { onConflict: 'clinic_id,remote_jid' })
        .select('id')
        .single();

      if (conv) {
        await supabaseService
          .from('whatsapp_messages')
          .insert({
            conversation_id: conv.id,
            message_id: result.key?.id || crypto.randomUUID(),
            content: message,
            message_type: messageType,
            is_from_me: true,
            sender_name: 'Você',
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
