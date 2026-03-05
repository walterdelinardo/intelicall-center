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
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!evolutionUrl || !evolutionKey || !instanceName) {
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { remoteJid, message, messageType = 'text', mediaUrl } = await req.json();

    if (!remoteJid || !message) {
      return new Response(
        JSON.stringify({ error: 'remoteJid and message are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Send message via Evolution API v3
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

    // Store sent message in DB using service role
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const userId = user.id;
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('clinic_id')
      .eq('id', userId)
      .single();

    if (profile?.clinic_id) {
      // Find or create conversation
      const { data: conv } = await supabaseService
        .from('whatsapp_conversations')
        .upsert({
          clinic_id: profile.clinic_id,
          remote_jid: remoteJid,
          last_message: message,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          status: 'active',
        }, { onConflict: 'clinic_id,remote_jid' })
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
