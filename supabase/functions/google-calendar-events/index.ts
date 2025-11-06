import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');

    if (!apiKey || !calendarId) {
      throw new Error('Google Calendar credentials not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'list') {
      // Buscar eventos
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // próximos 30 dias

      const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&orderBy=startTime&singleEvents=true&maxResults=50`;

      console.log('Fetching events from Google Calendar');
      const response = await fetch(calendarUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Calendar API error:', errorText);
        throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Formatar eventos para o formato do app
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
      // Criar evento
      const body = await req.json();
      const { title, description, startDateTime, endDateTime } = body;

      if (!title || !startDateTime || !endDateTime) {
        throw new Error('Missing required fields: title, startDateTime, endDateTime');
      }

      const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}`;

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
      const response = await fetch(calendarUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

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

    } else {
      throw new Error('Invalid action. Use ?action=list or ?action=create');
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
