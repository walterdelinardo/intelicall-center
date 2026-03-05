
-- WhatsApp conversations table
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) NOT NULL,
  remote_jid TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_photo_url TEXT,
  is_group BOOLEAN DEFAULT false,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id, remote_jid)
);

-- WhatsApp messages table
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  is_from_me BOOLEAN DEFAULT false,
  sender_name TEXT,
  media_url TEXT,
  media_type TEXT,
  status TEXT DEFAULT 'received',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view whatsapp conversations in their clinic"
  ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert whatsapp conversations in their clinic"
  ON public.whatsapp_conversations FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update whatsapp conversations in their clinic"
  ON public.whatsapp_conversations FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Allow webhook (service role) to insert/update via edge function
-- For messages, access through conversation's clinic_id
CREATE POLICY "Users can view messages in their clinic conversations"
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations wc
    WHERE wc.id = whatsapp_messages.conversation_id
    AND wc.clinic_id = get_user_clinic_id(auth.uid())
  ));

CREATE POLICY "Users can insert messages in their clinic conversations"
  ON public.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations wc
    WHERE wc.id = whatsapp_messages.conversation_id
    AND wc.clinic_id = get_user_clinic_id(auth.uid())
  ));

-- Allow service role (edge functions) full access for webhook
CREATE POLICY "Service role full access conversations"
  ON public.whatsapp_conversations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access messages"
  ON public.whatsapp_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Realtime for live messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
