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
    
    console.log('Received Chatwoot webhook:', JSON.stringify(payload, null, 2));

    const { event, conversation, message_type, account, content } = payload;

    if (!event) {
      return new Response(
        JSON.stringify({ error: 'No event type provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Handle conversation events
    if (event === 'conversation_created' || event === 'conversation_updated' || event === 'conversation_status_changed') {
      const conversationData = {
        conversation_id: conversation.id?.toString() || '',
        account_id: account?.id?.toString() || '',
        inbox_id: conversation.inbox_id?.toString(),
        contact_name: conversation.meta?.sender?.name || 'Unknown',
        contact_phone: conversation.meta?.sender?.phone_number,
        contact_email: conversation.meta?.sender?.email,
        status: conversation.status || 'open',
        last_message: conversation.messages?.[0]?.content || content,
        last_message_at: conversation.timestamp ? new Date(conversation.timestamp * 1000).toISOString() : new Date().toISOString(),
        assignee_name: conversation.meta?.assignee?.name,
        metadata: conversation,
      };

      const { error: convError } = await supabase
        .from('chatwoot_conversations')
        .upsert(conversationData, { onConflict: 'conversation_id' });

      if (convError) {
        console.error('Error upserting conversation:', convError);
        throw convError;
      }

      console.log('Conversation upserted successfully');
    }

    // Handle message events
    if (event === 'message_created' && message_type === 'incoming') {
      const messageData = {
        message_id: payload.id?.toString() || '',
        conversation_id: conversation?.id?.toString() || '',
        content: content || '',
        message_type: message_type || 'text',
        sender_type: payload.message_type || 'incoming',
        sender_name: payload.sender?.name || 'Contact',
        attachments: payload.attachments || [],
      };

      const { error: msgError } = await supabase
        .from('chatwoot_messages')
        .upsert(messageData, { onConflict: 'message_id' });

      if (msgError) {
        console.error('Error upserting message:', msgError);
        throw msgError;
      }

      // Update conversation last message
      await supabase
        .from('chatwoot_conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
        })
        .eq('conversation_id', conversation?.id?.toString());

      console.log('Message upserted successfully');
    }

    return new Response(
      JSON.stringify({ success: true, event }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});