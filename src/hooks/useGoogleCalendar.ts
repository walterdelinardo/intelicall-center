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

      const body: any = {};
      if (accountId) body.account_id = accountId;

      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      if (data?.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
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
