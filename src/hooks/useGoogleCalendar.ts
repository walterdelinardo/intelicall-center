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
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado');
        return;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error fetching events:', error);
        if (error.message?.includes('not connected')) {
          toast.error('Conecte sua conta do Google Calendar primeiro');
        } else {
          toast.error('Erro ao buscar eventos do Google Calendar');
        }
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: { ...eventData, action: 'create' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error creating event:', error);
        if (error.message?.includes('not connected')) {
          toast.error('Conecte sua conta do Google Calendar primeiro');
        } else {
          toast.error('Erro ao criar evento');
        }
        return false;
      }

      if (data?.success) {
        toast.success('Evento criado com sucesso!');
        await fetchEvents();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error:', error);
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
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: { ...eventData, action: 'update' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error updating event:', error);
        if (error.message?.includes('not connected')) {
          toast.error('Conecte sua conta do Google Calendar primeiro');
        } else {
          toast.error('Erro ao atualizar evento');
        }
        return false;
      }

      if (data?.success) {
        toast.success('Evento atualizado com sucesso!');
        await fetchEvents();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao atualizar evento no Google Calendar');
      return false;
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: { eventId, action: 'delete' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error deleting event:', error);
        if (error.message?.includes('not connected')) {
          toast.error('Conecte sua conta do Google Calendar primeiro');
        } else {
          toast.error('Erro ao excluir evento');
        }
        return false;
      }

      if (data?.success) {
        toast.success('Evento excluído com sucesso!');
        await fetchEvents();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao excluir evento no Google Calendar');
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
    updateEvent,
    deleteEvent,
  };
};
