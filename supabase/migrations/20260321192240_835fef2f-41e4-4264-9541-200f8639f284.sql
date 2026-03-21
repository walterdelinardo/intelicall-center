ALTER TABLE public.appointments ADD COLUMN google_event_id text;
CREATE INDEX idx_appointments_google_event_id ON public.appointments(google_event_id);