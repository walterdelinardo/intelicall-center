
-- Drop old unique constraint if it exists
ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_clinic_id_remote_jid_key;

-- Create new unique constraint including inbox_id
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_clinic_inbox_jid_key 
  ON public.whatsapp_conversations (clinic_id, inbox_id, remote_jid)
  WHERE inbox_id IS NOT NULL;

-- Keep a fallback unique for conversations without inbox
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_clinic_jid_no_inbox_key 
  ON public.whatsapp_conversations (clinic_id, remote_jid)
  WHERE inbox_id IS NULL;

-- Create whatsapp-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for whatsapp-media bucket: authenticated users can upload
CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Anyone can read public whatsapp media
CREATE POLICY "Public read whatsapp media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'whatsapp-media');
