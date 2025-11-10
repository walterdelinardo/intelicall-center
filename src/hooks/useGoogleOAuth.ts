import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useGoogleOAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkConnection = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsConnected(false);
        return;
      }

      const { data, error } = await supabase
        .from('google_oauth_tokens')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking connection:', error);
        setIsConnected(false);
        return;
      }

      // Check if token exists and is not expired
      if (data) {
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        setIsConnected(expiresAt > now);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const initiateOAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Você precisa estar logado');
        return;
      }

      const clientId = '282570764186-4s0gf5qguon2ddfsocp41cphsq99ta50.apps.googleusercontent.com';
      const redirectUri = `${window.location.origin}/supabase/functions/v1/google-oauth-callback`;
      const scope = 'https://www.googleapis.com/auth/calendar';
      const state = user.id;

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', clientId);
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

  const disconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return;
      }

      const { error } = await supabase
        .from('google_oauth_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error disconnecting:', error);
        toast.error('Erro ao desconectar');
        return;
      }

      setIsConnected(false);
      toast.success('Desconectado do Google Calendar');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao desconectar');
    }
  };

  useEffect(() => {
    checkConnection();

    // Check for OAuth callback success
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_auth') === 'success') {
      toast.success('Conectado ao Google Calendar com sucesso!');
      checkConnection();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return {
    isConnected,
    loading,
    initiateOAuth,
    disconnect,
    checkConnection,
  };
};
