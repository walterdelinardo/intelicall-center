import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ParsedEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  status: 'confirmed' | 'pending';
  description: string;
  startDateTime: string | null;
  endDateTime: string | null;
}

function parseICalDate(value: string): Date | null {
  if (!value) return null;
  // Handle TZID format: DTSTART;TZID=America/Sao_Paulo:20250315T090000
  const cleanValue = value.replace(/^.*:/, '');
  
  // Format: 20250315T090000Z or 20250315T090000 or 20250315
  const match = cleanValue.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!match) return null;
  
  const [, year, month, day, hour, minute, second] = match;
  const isUTC = cleanValue.endsWith('Z');
  
  if (hour) {
    if (isUTC) {
      return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +(second || 0)));
    }
    return new Date(+year, +month - 1, +day, +hour, +minute, +(second || 0));
  }
  return new Date(+year, +month - 1, +day);
}

function parseICalFeed(icsText: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const lines: string[] = [];
  
  // Unfold lines (lines starting with space/tab are continuations)
  for (const rawLine of icsText.split(/\r?\n/)) {
    if (rawLine.startsWith(' ') || rawLine.startsWith('\t')) {
      if (lines.length > 0) {
        lines[lines.length - 1] += rawLine.slice(1);
      }
    } else {
      lines.push(rawLine);
    }
  }
  
  let inEvent = false;
  let currentEvent: Record<string, string> = {};
  
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }
    
    if (line === 'END:VEVENT') {
      inEvent = false;
      
      const startStr = currentEvent['DTSTART'] || '';
      const endStr = currentEvent['DTEND'] || '';
      const start = parseICalDate(startStr);
      const end = parseICalDate(endStr);
      
      if (start) {
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        // Only include events within ±30 days
        if (start >= thirtyDaysAgo && start <= thirtyDaysFromNow) {
          const hasTime = startStr.includes('T');
          const dateStr = start.toISOString().split('T')[0];
          const timeStr = hasTime 
            ? start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
            : 'Dia inteiro';
          
          let duration = 'Dia inteiro';
          if (hasTime && end) {
            const diffMin = Math.round((end.getTime() - start.getTime()) / 60000);
            if (diffMin > 0) duration = `${diffMin} min`;
          }
          
          const uid = currentEvent['UID'] || `ical-${Math.random().toString(36).slice(2)}`;
          const summary = (currentEvent['SUMMARY'] || 'Sem título')
            .replace(/\\n/g, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\\\/g, '\\');
          const description = (currentEvent['DESCRIPTION'] || '')
            .replace(/\\n/g, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\\\/g, '\\');
          
          events.push({
            id: uid,
            title: summary,
            date: dateStr,
            time: timeStr,
            duration,
            status: (currentEvent['STATUS'] || '').toUpperCase() === 'TENTATIVE' ? 'pending' : 'confirmed',
            description,
            startDateTime: hasTime ? start.toISOString() : null,
            endDateTime: hasTime && end ? end.toISOString() : null,
          });
        }
      }
      continue;
    }
    
    if (inEvent) {
      // Parse property, handling parameters (e.g., DTSTART;TZID=...:value)
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const fullKey = line.substring(0, colonIdx);
        const value = line.substring(colonIdx + 1);
        // Get the base property name (before any ;)
        const baseKey = fullKey.split(';')[0];
        // Store the full line (key with params : value) for date parsing
        currentEvent[baseKey] = line;
      }
    }
  }
  
  // Sort by date/time
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
  
  return events;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body = await req.json().catch(() => ({}));
    const { ical_url, account_id } = body;

    let url = ical_url;

    // If account_id provided, look up the ical_url from the database
    if (!url && account_id) {
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: account, error } = await supabase
        .from('google_calendar_accounts')
        .select('ical_url')
        .eq('id', account_id)
        .single();

      if (error || !account?.ical_url) {
        throw new Error('iCal URL not found for this account');
      }
      url = account.ical_url;
    }

    if (!url) {
      throw new Error('No iCal URL provided');
    }

    console.log('Fetching iCal feed from:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch iCal feed: ${response.status}`);
    }

    const icsText = await response.text();
    const events = parseICalFeed(icsText);

    console.log(`Parsed ${events.length} events from iCal feed`);

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-ical-events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
