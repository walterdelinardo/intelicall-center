import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatwootConversation {
  id: string;
  conversation_id: string;
  account_id: string;
  inbox_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  last_message: string | null;
  last_message_at: string | null;
  assignee_name: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export const useChatwootConversations = () => {
  const [conversations, setConversations] = useState<ChatwootConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data, error } = await supabase
          .from('chatwoot_conversations')
          .select('*')
          .order('updated_at', { ascending: false });

        if (error) throw error;

        setConversations(data || []);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('chatwoot-conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chatwoot_conversations'
        },
        (payload) => {
          console.log('Realtime conversation update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setConversations(prev => [payload.new as ChatwootConversation, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setConversations(prev => 
              prev.map(conv => 
                conv.id === payload.new.id ? payload.new as ChatwootConversation : conv
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setConversations(prev => prev.filter(conv => conv.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { conversations, loading };
};