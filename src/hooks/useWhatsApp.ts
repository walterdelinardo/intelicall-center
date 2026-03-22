import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppInbox {
  id: string;
  clinic_id: string;
  instance_name: string;
  phone_number: string | null;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConversation {
  id: string;
  clinic_id: string;
  inbox_id: string | null;
  remote_jid: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_photo_url: string | null;
  is_group: boolean;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  conversation_status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  message_id: string;
  content: string | null;
  message_type: string;
  is_from_me: boolean;
  sender_name: string | null;
  media_url: string | null;
  media_type: string | null;
  mime_type: string | null;
  caption: string | null;
  file_name: string | null;
  media_seconds: number | null;
  media_width: number | null;
  media_height: number | null;
  thumbnail_base64: string | null;
  base64: string | null;
  status: string;
  timestamp: string;
  created_at: string;
  is_internal_note: boolean;
}

export const useWhatsAppInboxes = (activeOnly = false) => {
  const [inboxes, setInboxes] = useState<WhatsAppInbox[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInboxes = useCallback(async () => {
    try {
      let query = supabase
        .from('whatsapp_inboxes')
        .select('*')
        .order('label');

      if (activeOnly) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      setInboxes((data as WhatsAppInbox[]) || []);
    } catch (error) {
      console.error('Error fetching inboxes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInboxes();
    const channel = supabase
      .channel('whatsapp-inboxes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_inboxes' }, () => fetchInboxes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchInboxes]);

  const createInbox = async (data: { instance_name: string; label: string; phone_number?: string; clinic_id: string }) => {
    const { error } = await supabase.from('whatsapp_inboxes').insert(data as any);
    if (error) throw error;
    await fetchInboxes();
  };

  const updateInbox = async (id: string, data: { label?: string; instance_name?: string; phone_number?: string; is_active?: boolean }) => {
    const { error } = await supabase.from('whatsapp_inboxes').update(data as any).eq('id', id);
    if (error) throw error;
    await fetchInboxes();
  };

  const toggleInbox = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('whatsapp_inboxes').update({ is_active } as any).eq('id', id);
    if (error) throw error;
    await fetchInboxes();
  };

  const deleteInbox = async (id: string) => {
    const { error } = await supabase.from('whatsapp_inboxes').delete().eq('id', id);
    if (error) throw error;
    await fetchInboxes();
  };

  return { inboxes, loading, refetch: fetchInboxes, createInbox, updateInbox, toggleInbox, deleteInbox };
};

interface ConversationFilters {
  inboxId?: string | null;
  statusFilter?: string | null;
  assignedToFilter?: 'mine' | 'all';
  showHidden?: boolean;
}

export const useWhatsAppConversations = (filters: ConversationFilters = {}) => {
  const { inboxId, statusFilter, assignedToFilter, showHidden = false } = filters;
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      let query = supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (inboxId) query = query.eq('inbox_id', inboxId);

      if (showHidden) {
        query = query.eq('conversation_status', 'encerrado');
      } else {
        if (statusFilter) {
          query = query.eq('conversation_status', statusFilter);
        } else {
          query = query.neq('conversation_status', 'encerrado');
        }
      }

      if (assignedToFilter === 'mine') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) query = query.eq('assigned_to', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setConversations((data as WhatsAppConversation[]) || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [inboxId, statusFilter, assignedToFilter, showHidden]);

  useEffect(() => {
    fetchConversations();
    const channel = supabase
      .channel(`whatsapp-conversations-${inboxId || 'all'}-${statusFilter || 'all'}-${showHidden}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations, inboxId, statusFilter]);

  return { conversations, loading, refetch: fetchConversations };
};

export const useWhatsAppMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });
      if (error) throw error;
      setMessages((data as WhatsAppMessage[]) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    if (!conversationId) return;

    const channel = supabase
      .channel(`whatsapp-messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as WhatsAppMessage]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === (payload.new as WhatsAppMessage).id ? payload.new as WhatsAppMessage : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, fetchMessages]);

  return { messages, loading, refetch: fetchMessages };
};

export const useSendWhatsAppMessage = () => {
  const [sending, setSending] = useState(false);

  const sendMessage = async (
    remoteJid: string,
    message: string,
    inboxId?: string | null,
    messageType: string = 'text',
    mediaUrl?: string | null
  ) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-evolution-message', {
        body: { remoteJid, message, inboxId, messageType, mediaUrl },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setSending(false);
    }
  };

  const sendInternalNote = async (conversationId: string, content: string) => {
    setSending(true);
    try {
      const { error } = await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        message_id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content,
        message_type: 'text',
        is_from_me: true,
        is_internal_note: true,
        status: 'read',
        timestamp: new Date().toISOString(),
      } as any);
      if (error) throw error;
    } catch (error) {
      console.error('Error sending internal note:', error);
      throw error;
    } finally {
      setSending(false);
    }
  };

  return { sendMessage, sendInternalNote, sending };
};

export const useConversationActions = () => {
  const assumeConversation = async (conversationId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ conversation_status: 'humano', assigned_to: user.id } as any)
      .eq('id', conversationId);
    if (error) throw error;
  };

  const returnToBot = async (conversationId: string) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ conversation_status: 'bot', assigned_to: null } as any)
      .eq('id', conversationId);
    if (error) throw error;
  };

  const closeConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ conversation_status: 'encerrado' } as any)
      .eq('id', conversationId);
    if (error) throw error;
  };

  const markAsRead = async (conversationId: string) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0 } as any)
      .eq('id', conversationId);
    if (error) throw error;
  };

  return { assumeConversation, returnToBot, closeConversation, markAsRead };
};
