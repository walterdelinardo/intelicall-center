import { Button } from '@/components/ui/button';
import { useGoogleOAuth } from '@/hooks/useGoogleOAuth';
import { Loader2 } from 'lucide-react';

export const GoogleAuthButton = () => {
  const { isConnected, loading, initiateOAuth, disconnect } = useGoogleOAuth();

  if (loading) {
    return (
      <Button disabled variant="outline">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Verificando...
      </Button>
    );
  }

  if (isConnected) {
    return (
      <Button onClick={disconnect} variant="outline">
        Desconectar Google Calendar
      </Button>
    );
  }

  return (
    <Button onClick={initiateOAuth} variant="default">
      Conectar Google Calendar
    </Button>
  );
};
