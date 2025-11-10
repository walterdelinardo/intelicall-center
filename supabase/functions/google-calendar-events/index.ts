import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Get Google OAuth token from database
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Google Calendar not connected. Please connect your account first.');
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    if (expiresAt <= now && tokenData.refresh_token) {
      console.log('Access token expired, refreshing...');
      
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh access token');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update token in database
      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
      await supabase
        .from('google_oauth_tokens')
        .update({
          access_token: accessToken,
          expires_at: newExpiresAt,
        })
        .eq('user_id', user.id);

      console.log('Token refreshed successfully');
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list';

    if (action === 'list') {
      console.log('Fetching events from Google Calendar');
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Calendar API error:', errorText);
        throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Format events for the app
      const events = data.items?.map((event: any) => ({
        id: event.id,
        title: event.summary || 'Sem título',
        date: event.start?.dateTime ? new Date(event.start.dateTime).toISOString().split('T')[0] : event.start?.date,
        time: event.start?.dateTime ? new Date(event.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Dia inteiro',
        duration: event.start?.dateTime && event.end?.dateTime 
          ? `${Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000)} min`
          : 'Dia inteiro',
        status: event.status === 'confirmed' ? 'confirmed' : 'pending',
        description: event.description || '',
      })) || [];

      console.log(`Found ${events.length} events`);

      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'create') {
      const { title, description, startDateTime, endDateTime } = body;

      if (!title || !startDateTime || !endDateTime) {
        throw new Error('Missing required fields: title, startDateTime, endDateTime');
      }

      const eventData = {
        summary: title,
        description: description || '',
        start: {
          dateTime: startDateTime,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'America/Sao_Paulo',
        },
      };

      console.log('Creating event in Google Calendar:', eventData);

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error creating event:', errorText);
        throw new Error(`Failed to create event: ${response.status} ${response.statusText}`);
      }

      const createdEvent = await response.json();
      console.log('Event created successfully:', createdEvent.id);

      return new Response(JSON.stringify({ 
        success: true,
        event: {
          id: createdEvent.id,
          title: createdEvent.summary,
          htmlLink: createdEvent.htmlLink,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'update') {
      const { eventId, title, description, startDateTime, endDateTime } = body;

      if (!eventId || !title || !startDateTime || !endDateTime) {
        throw new Error('Missing required fields: eventId, title, startDateTime, endDateTime');
      }

      const eventData = {
        summary: title,
        description: description || '',
        start: {
          dateTime: startDateTime,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'America/Sao_Paulo',
        },
      };

      console.log('Updating event in Google Calendar:', eventId, eventData);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error updating event:', errorText);
        throw new Error(`Failed to update event: ${response.status} ${response.statusText}`);
      }

      const updatedEvent = await response.json();
      console.log('Event updated successfully:', updatedEvent.id);

      return new Response(JSON.stringify({ 
        success: true,
        event: {
          id: updatedEvent.id,
          title: updatedEvent.summary,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'delete') {
      const { eventId } = body;

      if (!eventId) {
        throw new Error('Missing required field: eventId');
      }

      console.log('Deleting event from Google Calendar:', eventId);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error deleting event:', errorText);
        throw new Error(`Failed to delete event: ${response.status} ${response.statusText}`);
      }

      console.log('Event deleted successfully:', eventId);

      return new Response(JSON.stringify({ 
        success: true,
        eventId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      throw new Error('Invalid action. Use action: list, create, update, or delete');
    }

  } catch (error) {
    console.error('Error in google-calendar-events function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
