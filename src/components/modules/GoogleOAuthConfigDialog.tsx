import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface GoogleOAuthConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export const GoogleOAuthConfigDialog = ({ open, onOpenChange, onSaved }: GoogleOAuthConfigDialogProps) => {
  const { profile } = useAuth();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;

  useEffect(() => {
    if (open && profile?.clinic_id) {
      loadConfig();
    }
  }, [open, profile?.clinic_id]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('google_oauth_config')
        .select('*')
        .eq('clinic_id', profile!.clinic_id!)
        .maybeSingle();

      if (!error && data) {
        setClientId((data as any).client_id || "");
        setClientSecret((data as any).client_secret || "");
        setExistingId((data as any).id);
      } else {
        setClientId("");
        setClientSecret("");
        setExistingId(null);
      }
    } catch (e) {
      console.error("Error loading config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Preencha Client ID e Client Secret");
      return;
    }
    if (!profile?.clinic_id) {
      toast.error("Clínica não encontrada");
      return;
    }

    setSaving(true);
    try {
      if (existingId) {
        const { error } = await supabase
          .from('google_oauth_config')
          .update({
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('google_oauth_config')
          .insert({
            clinic_id: profile.clinic_id,
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
          } as any);
        if (error) throw error;
      }

      toast.success("Credenciais salvas com sucesso!");
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            Configurar Google Calendar API
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure a conexão OAuth 2.0 com o Google para sincronizar agendas.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-id">Client ID *</Label>
              <Input
                id="client-id"
                placeholder="xxxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                ID do cliente OAuth criado no Google Cloud Console
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-secret">Client Secret *</Label>
              <Input
                id="client-secret"
                type="password"
                placeholder="GOCSPX-xxxxxxxx"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Chave secreta do cliente OAuth
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="redirect-uri">Redirect URI *</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="redirect-uri"
                  value={redirectUri}
                  readOnly
                  className="text-xs font-mono bg-muted"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(redirectUri)}
                  title="Copiar"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copie esta URL para o Google Cloud Console → Authorized redirect URIs
              </p>
              <p className="text-xs text-destructive flex items-center gap-1">
                ⚠ Esta URL deve ser <strong>exatamente igual</strong> à configurada no Google Cloud Console
              </p>
            </div>

            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Google Cloud Console - Credenciais
            </a>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar Credenciais
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
