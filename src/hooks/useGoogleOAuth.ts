import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface GoogleCalendarAccount {
  id: string;
  label: string;
  calendar_id: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  ical_url: string | null;
  color: string | null;
}

export interface GoogleCalendarOption {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string | null;
  accessRole: string;
}

interface GoogleOAuthConfig {
  id: string;
  client_id: string;
}

export const useGoogleOAuth = () => {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<GoogleCalendarAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [oauthConfig, setOauthConfig] = useState<GoogleOAuthConfig | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      if (!profile?.clinic_id) {
        setAccounts([]);
        return;
      }

      const { data, error } = await supabase
        .from('google_calendar_accounts')
        .select('id, label, calendar_id, is_active, expires_at, created_at, ical_url, color')
        .order('created_at');

      if (error) {
        console.error('Error fetching accounts:', error);
        setAccounts([]);
        return;
      }

      setAccounts((data as any[]) || []);
    } catch (error) {
      console.error('Error:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOAuthConfig = async () => {
    if (!profile?.clinic_id) return null;
    const { data } = await supabase
      .from('google_oauth_config')
      .select('id, client_id')
      .eq('clinic_id', profile.clinic_id)
      .maybeSingle();
    const config = data ? { id: (data as any).id, client_id: (data as any).client_id } : null;
    setOauthConfig(config);
    return config;
  };

  const initiateOAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !profile?.clinic_id) {
        toast.error('Você precisa estar logado');
        return;
      }

      // Read client_id from config table
      let config = oauthConfig;
      if (!config) {
        config = await fetchOAuthConfig();
      }

      if (!config?.client_id) {
        toast.error('Configure as credenciais do Google primeiro');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
      const scope = 'https://www.googleapis.com/auth/calendar';
      const state = JSON.stringify({ user_id: user.id, clinic_id: profile.clinic_id, label: 'Conta Google' });

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', config.client_id);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', scope);
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
      authUrl.searchParams.append('state', state);

      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      toast.error('Erro ao iniciar autenticação');
    }
  };

  const updateLabel = async (accountId: string, label: string) => {
    const { error } = await supabase
      .from('google_calendar_accounts')
      .update({ label })
      .eq('id', accountId);

    if (error) {
      toast.error('Erro ao atualizar label');
      throw error;
    }

    toast.success('Label atualizado!');
    await fetchAccounts();
  };

  const toggleAccount = async (accountId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('google_calendar_accounts')
      .update({ is_active: isActive })
      .eq('id', accountId);

    if (error) {
      toast.error('Erro ao atualizar conta');
      throw error;
    }
    await fetchAccounts();
  };

  const deleteAccount = async (accountId: string) => {
    const { error } = await supabase
      .from('google_calendar_accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      toast.error('Erro ao excluir conta');
      throw error;
    }
    await fetchAccounts();
  };

  const fetchCalendars = async (accountId: string): Promise<GoogleCalendarOption[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Sessão expirada');
      return [];
    }

    const { data, error } = await supabase.functions.invoke('google-list-calendars', {
      body: { account_id: accountId },
    });

    if (error) {
      console.error('Error fetching calendars:', error);
      toast.error('Erro ao buscar calendários');
      return [];
    }

    return data?.calendars || [];
  };

  const updateCalendarId = async (accountId: string, calendarId: string) => {
    const { error } = await supabase
      .from('google_calendar_accounts')
      .update({ calendar_id: calendarId })
      .eq('id', accountId);

    if (error) {
      toast.error('Erro ao atualizar calendário');
      throw error;
    }

    toast.success('Calendário atualizado!');
    await fetchAccounts();
  };

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchAccounts();
      fetchOAuthConfig();
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('google_auth') === 'success') {
      toast.success('Conectado ao Google Calendar com sucesso!');
      fetchAccounts();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [profile?.clinic_id]);

  return {
    accounts,
    loading,
    oauthConfig,
    initiateOAuth,
    updateLabel,
    toggleAccount,
    deleteAccount,
    fetchCalendars,
    updateCalendarId,
    fetchAccounts,
    fetchOAuthConfig,
    isConnected: accounts.some((a) => a.is_active),
    hasCredentials: !!oauthConfig?.client_id,
  };
};
