import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      throw new Error('No authorization code provided');
    }

    // Get OAuth credentials from environment
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = `${url.origin}/supabase/functions/v1/google-oauth-callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Google OAuth credentials');
    }

    console.log('Exchanging code for tokens...');

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange error:', error);
      throw new Error(`Failed to exchange code for tokens: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    console.log('Tokens received successfully');

    // Get user ID from state (passed during auth initiation)
    const userId = state;

    if (!userId) {
      throw new Error('No user ID provided in state');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens in database
    const { error: dbError } = await supabase
      .from('google_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope,
      }, {
        onConflict: 'user_id',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store tokens');
    }

    console.log('Tokens stored successfully');

    // Redirect back to the app
    const appUrl = url.origin;
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${appUrl}/dashboard?google_auth=success`,
      },
    });
  } catch (error) {
    console.error('Error in google-oauth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
