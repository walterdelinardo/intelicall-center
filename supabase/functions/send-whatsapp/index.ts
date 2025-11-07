import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, message } = await req.json();
    
    console.log('Sending WhatsApp message:', { phoneNumber, message });

    if (!phoneNumber || !message) {
      throw new Error('Phone number and message are required');
    }

    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    
    if (!n8nWebhookUrl) {
      throw new Error('N8N_WEBHOOK_URL not configured');
    }

    // Send to N8N webhook
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber,
        message,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`N8N webhook failed: ${response.status}`);
    }

    const result = await response.json().catch(() => ({}));
    
    console.log('WhatsApp message sent successfully:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message sent to WhatsApp',
        data: result 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
