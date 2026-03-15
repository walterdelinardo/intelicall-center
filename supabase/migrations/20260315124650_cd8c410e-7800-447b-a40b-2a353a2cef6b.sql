
ALTER TABLE public.google_calendar_accounts
ADD COLUMN ical_url text;

-- When ical_url is set, the account fetches events from the iCal feed
-- instead of using OAuth tokens. access_token becomes optional for iCal accounts.
ALTER TABLE public.google_calendar_accounts
ALTER COLUMN access_token DROP NOT NULL;

ALTER TABLE public.google_calendar_accounts
ALTER COLUMN expires_at DROP NOT NULL;
