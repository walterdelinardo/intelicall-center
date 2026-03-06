
-- 1. Create whatsapp_inboxes table
CREATE TABLE public.whatsapp_inboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  phone_number text,
  label text NOT NULL DEFAULT 'Principal',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, instance_name)
);

ALTER TABLE public.whatsapp_inboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inboxes in their clinic" ON public.whatsapp_inboxes
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Admins can manage inboxes in their clinic" ON public.whatsapp_inboxes
  FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- 2. Add columns to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS inbox_id uuid REFERENCES public.whatsapp_inboxes(id),
  ADD COLUMN IF NOT EXISTS conversation_status text NOT NULL DEFAULT 'bot',
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- 3. Enable realtime for whatsapp_inboxes
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_inboxes;

-- 4. Create trigger for updated_at on whatsapp_inboxes
CREATE TRIGGER update_whatsapp_inboxes_updated_at
  BEFORE UPDATE ON public.whatsapp_inboxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
