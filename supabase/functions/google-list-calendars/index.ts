import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getValidAccessToken(supabase: any, account: any): Promise<string> {
  const expiresAt = new Date(account.expires_at);
  if (expiresAt > new Date()) return account.access_token;

  // Read credentials from google_oauth_config (per-clinic)
  let clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

  if (account.clinic_id) {
    const { data: config } = await supabase
      .from('google_oauth_config')
      .select('client_id, client_secret')
      .eq('clinic_id', account.clinic_id)
      .single();

    if (config) {
      clientId = config.client_id;
      clientSecret = config.client_secret;
    }
  }

  if (!clientId || !clientSecret) throw new Error('Missing Google OAuth credentials');
  if (!account.refresh_token) throw new Error('No refresh token available');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) throw new Error('Failed to refresh access token');

  const data = await response.json();
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await supabase
    .from('google_calendar_accounts')
    .update({ access_token: data.access_token, expires_at: newExpiresAt })
    .eq('id', account.id);

  return data.access_token;
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
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { account_id } = body;

    if (!account_id) {
      return new Response(JSON.stringify({ error: 'account_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: account, error: accError } = await supabase
      .from('google_calendar_accounts')
      .select('*')
      .eq('id', account_id)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!account.access_token || account.ical_url) {
      return new Response(JSON.stringify({ error: 'This account does not support calendar listing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getValidAccessToken(supabase, account);

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google CalendarList API error:', errorText);
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    const calendars = (data.items || []).map((cal: any) => ({
      id: cal.id,
      summary: cal.summary || cal.id,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor || null,
      accessRole: cal.accessRole || 'reader',
    }));

    return new Response(JSON.stringify({ calendars }), {
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
