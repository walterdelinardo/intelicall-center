
UPDATE public.clients
SET whatsapp_inbox_id = (
  SELECT id FROM public.whatsapp_inboxes WHERE instance_name = 'demo-nw-1' LIMIT 1
)
WHERE lead_source = 'whatsapp' AND whatsapp_inbox_id IS NULL;
