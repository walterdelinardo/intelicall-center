-- Fix conversations that have "Você" as contact_name by replacing with contact_phone
UPDATE whatsapp_conversations 
SET contact_name = COALESCE(NULLIF(contact_phone, ''), REPLACE(REPLACE(remote_jid, '@s.whatsapp.net', ''), '@g.us', ''))
WHERE contact_name = 'Você';