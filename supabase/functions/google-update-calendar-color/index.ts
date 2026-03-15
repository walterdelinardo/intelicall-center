import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function refreshAccessToken(
  supabase: any,
  account: any,
  clientId: string,
  clientSecret: string
): Promise<string> {
  if (!account.refresh_token) throw new Error('No refresh token available');

  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!refreshResponse.ok) throw new Error('Failed to refresh access token');

  const refreshData = await refreshResponse.json();
  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

  await supabase
    .from('google_calendar_accounts')
    .update({ access_token: refreshData.access_token, expires_at: newExpiresAt })
    .eq('id', account.id);

  return refreshData.access_token;
}

async function getValidAccessToken(supabase: any, account: any): Promise<string> {
  const expiresAt = new Date(account.expires_at);
  if (expiresAt > new Date()) return account.access_token;

  const { data: oauthConfig, error: configError } = await supabase
    .from('google_oauth_config')
    .select('client_id, client_secret')
    .eq('clinic_id', account.clinic_id)
    .single();

  if (configError || !oauthConfig) {
    throw new Error('Google OAuth credentials not found for this clinic');
  }

  return refreshAccessToken(supabase, account, oauthConfig.client_id, oauthConfig.client_secret);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { account_id, color } = body;

    if (!account_id || !color) {
      throw new Error('account_id and color are required');
    }

    // Fetch account
    const { data: account, error: accError } = await supabase
      .from('google_calendar_accounts')
      .select('*')
      .eq('id', account_id)
      .single();

    if (accError || !account) throw new Error('Account not found');

    // Save color locally
    await supabase
      .from('google_calendar_accounts')
      .update({ color })
      .eq('id', account_id);

    // If account has OAuth tokens, update color in Google Calendar
    if (account.access_token) {
      try {
        const accessToken = await getValidAccessToken(supabase, account);

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendarList/${encodeURIComponent(account.calendar_id)}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              backgroundColor: color,
              foregroundColor: '#ffffff',
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Google Calendar API error updating color:', errorText);
          // Don't throw - we still saved locally
        } else {
          console.log('Color updated in Google Calendar for account', account_id);
        }
      } catch (err) {
        console.error('Error updating color in Google:', err);
        // Color saved locally, Google sync failed silently
      }
    }

    return new Response(JSON.stringify({ success: true, color }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
