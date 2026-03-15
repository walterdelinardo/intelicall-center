import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');

    if (!code) {
      throw new Error('No authorization code provided');
    }

    let userId: string;
    let clinicId: string;
    let label = 'Conta Google';

    try {
      const stateData = JSON.parse(stateParam || '{}');
      userId = stateData.user_id;
      clinicId = stateData.clinic_id;
      label = stateData.label || 'Conta Google';
    } catch {
      userId = stateParam || '';
      clinicId = '';
    }

    if (!userId) {
      throw new Error('No user ID provided in state');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;

    // Read credentials from google_oauth_config table (per-clinic)
    let clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
    let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

    if (clinicId) {
      const { data: config } = await supabase
        .from('google_oauth_config')
        .select('client_id, client_secret')
        .eq('clinic_id', clinicId)
        .single();

      if (config) {
        clientId = config.client_id;
        clientSecret = config.client_secret;
      }
    }

    if (!clientId || !clientSecret) {
      throw new Error('Missing Google OAuth credentials. Configure them in Settings.');
    }

    console.log('Exchanging code for tokens...');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    if (clinicId) {
      const { error: dbError } = await supabase
        .from('google_calendar_accounts')
        .insert({
          user_id: userId,
          clinic_id: clinicId,
          label,
          calendar_id: 'primary',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
          scope: tokens.scope || 'https://www.googleapis.com/auth/calendar',
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to store tokens');
      }
    } else {
      const { error: dbError } = await supabase
        .from('google_oauth_tokens')
        .upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          scope: tokens.scope,
        }, { onConflict: 'user_id' });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to store tokens');
      }
    }

    console.log('Tokens stored successfully');

    const appUrl = Deno.env.get('APP_URL') || 'https://id-preview--c60d1b58-c36a-4470-8a43-03e327dda9dd.lovable.app';
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
