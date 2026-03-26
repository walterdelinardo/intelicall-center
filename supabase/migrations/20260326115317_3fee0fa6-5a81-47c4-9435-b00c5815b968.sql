
-- Telegram bots configuration table
CREATE TABLE public.telegram_bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  bot_token TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  webhook_receive_messages BOOLEAN NOT NULL DEFAULT false,
  webhook_stock_alerts BOOLEAN NOT NULL DEFAULT false,
  webhook_financial_reports BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view telegram bots in their clinic"
  ON public.telegram_bots FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Admins can manage telegram bots in their clinic"
  ON public.telegram_bots FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- Telegram notifications table
CREATE TABLE public.telegram_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'incoming',
  notification_type TEXT NOT NULL DEFAULT 'message',
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view telegram notifications in their clinic"
  ON public.telegram_notifications FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update telegram notifications in their clinic"
  ON public.telegram_notifications FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Service role full access telegram_notifications"
  ON public.telegram_notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access telegram_bots"
  ON public.telegram_bots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_notifications;
