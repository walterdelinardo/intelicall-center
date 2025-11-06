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
}

export const useGoogleCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: {},
        method: 'GET',
      });

      if (error) {
        console.error('Error fetching events:', error);
        toast.error('Erro ao buscar eventos do Google Calendar');
        return;
      }

      if (data?.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao conectar com Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (eventData: {
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: {
          action: 'create',
          ...eventData,
        },
      });

      if (error) {
        console.error('Error creating event:', error);
        toast.error('Erro ao criar evento');
        return false;
      }

      if (data?.success) {
        toast.success('Evento criado com sucesso!');
        await fetchEvents(); // Recarregar eventos
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao criar evento no Google Calendar');
      return false;
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return {
    events,
    loading,
    fetchEvents,
    createEvent,
  };
};
