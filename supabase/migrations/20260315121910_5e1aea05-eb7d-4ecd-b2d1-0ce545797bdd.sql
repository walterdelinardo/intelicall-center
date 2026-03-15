
ALTER TABLE public.clients
ADD COLUMN whatsapp_inbox_id uuid REFERENCES public.whatsapp_inboxes(id) ON DELETE SET NULL;
