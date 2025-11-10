-- Create table for storing Google OAuth tokens
CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own tokens"
ON public.google_oauth_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
ON public.google_oauth_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
ON public.google_oauth_tokens
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
ON public.google_oauth_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_google_oauth_tokens_updated_at
BEFORE UPDATE ON public.google_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_chatwoot_updated_at();