import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  status: 'confirmed' | 'pending';
  description?: string;
  account_id?: string;
  account_label?: string;
  startDateTime?: string;
  endDateTime?: string;
}

export const useGoogleCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async (accountId?: string) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      // Fetch from OAuth accounts
      const body: any = {};
      if (accountId) body.account_id = accountId;

      const [oauthResult, icalResult] = await Promise.allSettled([
        supabase.functions.invoke('google-calendar-events', { body, headers: authHeaders }),
        // Fetch iCal accounts list first, then fetch events for each
        fetchICalEvents(session.access_token),
      ]);

      const allEvents: CalendarEvent[] = [];

      if (oauthResult.status === 'fulfilled' && oauthResult.value.data?.events) {
        allEvents.push(...oauthResult.value.data.events);
      }

      if (icalResult.status === 'fulfilled') {
        allEvents.push(...icalResult.value);
      }

      // Sort combined events
      allEvents.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });

      setEvents(allEvents);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchICalEvents = async (accessToken: string): Promise<CalendarEvent[]> => {
    // Get iCal accounts from the database
    const { data: accounts } = await supabase
      .from('google_calendar_accounts')
      .select('id, label, ical_url, is_active');

    const icalAccounts = ((accounts as any[]) || []).filter(
      (a: any) => a.ical_url && a.is_active
    );

    if (icalAccounts.length === 0) return [];

    const allICalEvents: CalendarEvent[] = [];

    for (const account of icalAccounts) {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-ical-events', {
          body: { account_id: account.id },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!error && data?.events) {
          allICalEvents.push(
            ...data.events.map((e: any) => ({
              ...e,
              account_id: account.id,
              account_label: account.label,
            }))
          );
        }
      } catch (err) {
        console.error(`Error fetching iCal for account ${account.id}:`, err);
      }
    }

    return allICalEvents;
  };

  const createEvent = async (eventData: {
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    account_id?: string;
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Você precisa estar logado'); return false; }

      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: { ...eventData, action: 'create' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) { toast.error('Erro ao criar evento'); return false; }
      if (data?.success) {
        toast.success('Evento criado no Google Calendar!');
        await fetchEvents();
        return true;
      }
      return false;
    } catch (error) {
      toast.error('Erro ao criar evento no Google Calendar');
      return false;
    }
  };

  const updateEvent = async (eventData: {
    eventId: string;
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    account_id?: string;
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Você precisa estar logado'); return false; }

      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: { ...eventData, action: 'update' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) { toast.error('Erro ao atualizar evento'); return false; }
      if (data?.success) {
        toast.success('Evento atualizado!');
        await fetchEvents();
        return true;
      }
      return false;
    } catch (error) {
      toast.error('Erro ao atualizar evento');
      return false;
    }
  };

  const deleteEvent = async (eventId: string, accountId?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Você precisa estar logado'); return false; }

      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: { eventId, action: 'delete', account_id: accountId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) { toast.error('Erro ao excluir evento'); return false; }
      if (data?.success) {
        toast.success('Evento excluído!');
        await fetchEvents();
        return true;
      }
      return false;
    } catch (error) {
      toast.error('Erro ao excluir evento');
      return false;
    }
  };

  return { events, loading, fetchEvents, createEvent, updateEvent, deleteEvent };
};
