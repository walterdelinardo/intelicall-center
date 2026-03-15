CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  message_id text,
  payload_format text,
  event text,
  instance_name text,
  remote_jid text,
  message_type text,
  has_base64 boolean DEFAULT false,
  base64_length integer DEFAULT 0,
  base64_source text,
  has_media_url boolean DEFAULT false,
  media_url text,
  mime_type text,
  is_duplicate boolean DEFAULT false,
  merge_result text,
  merge_error text,
  raw_payload jsonb,
  normalized_data jsonb
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access webhook_logs"
  ON public.webhook_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view webhook_logs"
  ON public.webhook_logs FOR SELECT TO authenticated
  USING (true);