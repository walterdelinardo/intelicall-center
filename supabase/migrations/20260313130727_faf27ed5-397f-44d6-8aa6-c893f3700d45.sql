ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS media_seconds integer,
  ADD COLUMN IF NOT EXISTS media_width integer,
  ADD COLUMN IF NOT EXISTS media_height integer,
  ADD COLUMN IF NOT EXISTS thumbnail_base64 text,
  ADD COLUMN IF NOT EXISTS base64 text;