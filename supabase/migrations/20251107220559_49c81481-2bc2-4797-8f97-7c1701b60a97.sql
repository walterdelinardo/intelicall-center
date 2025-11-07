-- Create table for Chatwoot conversations
CREATE TABLE IF NOT EXISTS public.chatwoot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  inbox_id TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  status TEXT DEFAULT 'open',
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  assignee_name TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for Chatwoot messages
CREATE TABLE IF NOT EXISTS public.chatwoot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  conversation_id TEXT NOT NULL,
  content TEXT,
  message_type TEXT,
  sender_type TEXT,
  sender_name TEXT,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chatwoot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatwoot_messages ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for webhook)
CREATE POLICY "Allow all operations on chatwoot_conversations"
  ON public.chatwoot_conversations FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on chatwoot_messages"
  ON public.chatwoot_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER TABLE public.chatwoot_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.chatwoot_messages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chatwoot_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chatwoot_messages;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chatwoot_conversations_status ON public.chatwoot_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chatwoot_conversations_updated ON public.chatwoot_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatwoot_messages_conversation ON public.chatwoot_messages(conversation_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_chatwoot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_chatwoot_conversations_updated_at
  BEFORE UPDATE ON public.chatwoot_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chatwoot_updated_at();