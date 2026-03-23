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

  const { data: oauthConfig } = await supabase
    .from('google_oauth_config')
    .select('client_id, client_secret')
    .eq('clinic_id', account.clinic_id)
    .single();

  if (!oauthConfig) throw new Error('Google OAuth credentials not found');
  return refreshAccessToken(supabase, account, oauthConfig.client_id, oauthConfig.client_secret);
}

async function determineAction(
  supabase: any,
  event: any,
  clinicId: string
): Promise<string> {
  const eventId = event.id;

  if (event.status === 'cancelled') return 'cancelled';

  // Check if this event already exists in appointments (created internally)
  const { data: existingAppt } = await supabase
    .from('appointments')
    .select('id')
    .eq('google_event_id', eventId)
    .maybeSingle();

  if (existingAppt) return 'updated';

  // Check if we already have a notification for this event_id (meaning it was seen before)
  const { data: existingNotif } = await supabase
    .from('calendar_notifications')
    .select('id')
    .eq('event_id', eventId)
    .eq('clinic_id', clinicId)
    .limit(1);

  if (existingNotif && existingNotif.length > 0) return 'updated';

  return 'created';
}

async function isDuplicate(
  supabase: any,
  clinicId: string,
  eventTitle: string,
  action: string
): Promise<boolean> {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('calendar_notifications')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('event_title', eventTitle)
    .eq('action', action)
    .gte('created_at', twoMinAgo)
    .limit(1);

  return !!(data && data.length > 0);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('id', userId)
      .single();

    if (!profile?.clinic_id) throw new Error('User has no clinic');
    const clinicId = profile.clinic_id;

    const { data: accounts } = await supabase
      .from('google_calendar_accounts')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .not('access_token', 'is', null);

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalNotifications = 0;

    for (const account of accounts) {
      try {
        const accessToken = await getValidAccessToken(supabase, account);

        const { data: syncState } = await supabase
          .from('google_calendar_sync_state')
          .select('sync_token')
          .eq('account_id', account.id)
          .single();

        const isFirstSync = !syncState;

        let url: string;
        if (syncState?.sync_token) {
          url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendar_id)}/events?syncToken=${encodeURIComponent(syncState.sync_token)}`;
        } else {
          const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
          url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendar_id)}/events?timeMin=${timeMin}&singleEvents=true&maxResults=2500`;
        }

        let nextSyncToken: string | null = null;
        let allItems: any[] = [];
        let pageToken = '';

        do {
          const fetchUrl = pageToken ? `${url}&pageToken=${pageToken}` : url;
          const response = await fetch(fetchUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });

          if (response.status === 410) {
            console.log(`Sync token expired for account ${account.id}, resetting...`);
            await supabase
              .from('google_calendar_sync_state')
              .delete()
              .eq('account_id', account.id);
            break;
          }

          if (!response.ok) {
            console.error(`Google API error for account ${account.id}: ${response.status}`);
            break;
          }

          const data = await response.json();
          allItems.push(...(data.items || []));
          pageToken = data.nextPageToken || '';
          if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
        } while (pageToken);

        if (nextSyncToken) {
          await supabase
            .from('google_calendar_sync_state')
            .upsert({
              account_id: account.id,
              sync_token: nextSyncToken,
              last_synced_at: new Date().toISOString(),
            }, { onConflict: 'account_id' });
        }

        if (isFirstSync) {
          console.log(`First sync for account ${account.id}: saved initial token, ${allItems.length} events indexed`);
          continue;
        }

        for (const event of allItems) {
          const eventId = event.id;
          const eventTitle = event.summary || 'Sem título';

          const action = await determineAction(supabase, event, clinicId);

          // Check for duplicate (internal notification created moments ago)
          const duplicate = await isDuplicate(supabase, clinicId, eventTitle, action);
          if (duplicate) {
            console.log(`Skipping duplicate notification for "${eventTitle}" action=${action}`);
            continue;
          }

          const startDT = event.start?.dateTime
            ? new Date(event.start.dateTime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            : event.start?.date || '';

          let details = '';
          if (action === 'cancelled') {
            details = `Evento cancelado externamente`;
          } else if (action === 'updated') {
            details = `Evento atualizado externamente — ${startDT}`;
          } else {
            details = `Novo evento criado externamente — ${startDT}`;
          }

          await supabase.from('calendar_notifications').insert({
            clinic_id: clinicId,
            account_id: account.id,
            event_id: eventId,
            event_title: eventTitle,
            action,
            details,
            actor_name: event.creator?.email || 'Externo',
          });
          totalNotifications++;
        }

        console.log(`Account ${account.id}: ${allItems.length} changes, ${totalNotifications} notifications`);
      } catch (err) {
        console.error(`Error syncing account ${account.id}:`, err);
      }
    }

    return new Response(JSON.stringify({ synced: totalNotifications }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
