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

  console.log('Token refreshed for account', account.id);
  return refreshData.access_token;
}

async function getValidAccessToken(
  supabase: any,
  account: any
): Promise<string> {
  const expiresAt = new Date(account.expires_at);
  if (expiresAt > new Date()) return account.access_token;

  console.log('Access token expired for account', account.id, ', refreshing...');

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

async function listEvents(accessToken: string, calendarId: string) {
  const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Calendar API error:', errorText);
    throw new Error(`Google Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  return data.items?.map((event: any) => {
    const startDT = event.start?.dateTime ? new Date(event.start.dateTime) : null;
    const endDT = event.end?.dateTime ? new Date(event.end.dateTime) : null;

    let date: string;
    let time: string;
    if (startDT) {
      date = startDT.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      time = startDT.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    } else {
      date = event.start?.date || '';
      time = 'Dia inteiro';
    }

    const duration = startDT && endDT
      ? `${Math.round((endDT.getTime() - startDT.getTime()) / 60000)} min`
      : 'Dia inteiro';

    return {
      id: event.id,
      title: event.summary || 'Sem título',
      date,
      time,
      duration,
      status: event.status === 'confirmed' ? 'confirmed' : 'pending',
      description: event.description || '',
      startDateTime: event.start?.dateTime || null,
      endDateTime: event.end?.dateTime || null,
      extendedProperties: event.extendedProperties?.private || null,
    };
  }) || [];
}

async function createEvent(accessToken: string, calendarId: string, body: any) {
  const { title, description, startDateTime, endDateTime, extendedProperties } = body;
  if (!title || !startDateTime || !endDateTime) throw new Error('Missing required fields');

  const eventBody: any = {
    summary: title,
    description: description || '',
    start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
  };

  if (extendedProperties) {
    eventBody.extendedProperties = { private: extendedProperties };
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) throw new Error(`Failed to create event: ${response.status}`);
  const created = await response.json();
  return { success: true, event: { id: created.id, title: created.summary, htmlLink: created.htmlLink } };
}

async function updateEvent(accessToken: string, calendarId: string, body: any) {
  const { eventId, title, description, startDateTime, endDateTime, extendedProperties } = body;
  if (!eventId || !title || !startDateTime || !endDateTime) throw new Error('Missing required fields');

  const eventBody: any = {
    summary: title,
    description: description || '',
    start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
  };

  if (extendedProperties) {
    eventBody.extendedProperties = { private: extendedProperties };
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) throw new Error(`Failed to update event: ${response.status}`);
  const updated = await response.json();
  return { success: true, event: { id: updated.id, title: updated.summary } };
}

async function deleteEvent(accessToken: string, calendarId: string, eventId: string) {
  if (!eventId) throw new Error('Missing eventId');

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) throw new Error(`Failed to delete event: ${response.status}`);
  return { success: true, eventId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = data.claims.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list';
    const accountId = body.account_id;

    let accounts: any[] = [];

    if (accountId) {
      const { data: accData, error } = await supabase
        .from('google_calendar_accounts')
        .select('*')
        .eq('id', accountId)
        .eq('is_active', true)
        .single();

      if (error || !accData) throw new Error('Google Calendar account not found');
      accounts = [accData];
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('id', userId)
        .single();

      if (!profile?.clinic_id) throw new Error('User has no clinic');

      const { data: accData, error } = await supabase
        .from('google_calendar_accounts')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('is_active', true);

      if (error) throw error;
      accounts = accData || [];
    }

    if (accounts.length === 0) {
      if (action === 'list') {
        return new Response(JSON.stringify({ events: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('Google Calendar not connected. Please connect your account first.');
    }

    if (action === 'list') {
      const allEvents: any[] = [];
      for (const account of accounts) {
        if (account.ical_url && !account.access_token) continue;
        if (!account.access_token) continue;

        try {
          const accessToken = await getValidAccessToken(supabase, account);
          const events = await listEvents(accessToken, account.calendar_id);
          allEvents.push(...events.map((e: any) => ({
            ...e,
            account_id: account.id,
            account_label: account.label,
            account_color: account.color || null,
          })));
        } catch (err) {
          console.error(`Error fetching from account ${account.id}:`, err);
        }
      }

      allEvents.sort((a, b) => {
        const da = a.startDateTime || `${a.date}T${a.time}`;
        const db = b.startDateTime || `${b.date}T${b.time}`;
        return da.localeCompare(db);
      });

      console.log(`Found ${allEvents.length} events from OAuth accounts`);
      return new Response(JSON.stringify({ events: allEvents }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const account = accounts[0];
    const accessToken = await getValidAccessToken(supabase, account);

    let result;
    if (action === 'create') {
      result = await createEvent(accessToken, account.calendar_id, body);
    } else if (action === 'update') {
      result = await updateEvent(accessToken, account.calendar_id, body);
    } else if (action === 'delete') {
      result = await deleteEvent(accessToken, account.calendar_id, body.eventId);
    } else {
      throw new Error('Invalid action');
    }

    return new Response(JSON.stringify(result), {
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
