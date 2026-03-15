import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface GoogleOAuthConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onConnect: () => void;
  hasCredentials: boolean;
}

export const GoogleOAuthConfigDialog = ({ open, onOpenChange, onSaved, onConnect, hasCredentials }: GoogleOAuthConfigDialogProps) => {
  const { profile } = useAuth();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
  const previewOrigin = window.location.origin;

  useEffect(() => {
    if (open && profile?.clinic_id) {
      loadConfig();
    }
    if (!open) {
      setCredentialsSaved(false);
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
        setCredentialsSaved(true);
      } else {
        setClientId("");
        setClientSecret("");
        setExistingId(null);
        setCredentialsSaved(false);
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
      setCredentialsSaved(true);
      onSaved();
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

  const handleConnect = () => {
    onConnect();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            Conectar Google Calendar
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure as credenciais OAuth 2.0 do Google Cloud Console para sincronizar agendas.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step-by-step instructions */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">📋 Passo a passo no Google Cloud Console:</p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Acesse o <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Crie um projeto (ou selecione um existente)</li>
                <li>Ative a <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Google Calendar API <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Crie credenciais → <strong>ID do cliente OAuth 2.0</strong> (tipo: Aplicativo Web)</li>
                <li>Em <strong>Origens JavaScript autorizadas</strong>, adicione:</li>
              </ol>
              <div className="flex items-center gap-1 ml-4">
                <Input
                  value={previewOrigin}
                  readOnly
                  className="text-xs font-mono bg-background h-7 flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7"
                  onClick={() => copyToClipboard(previewOrigin)}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <ol start={6} className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Em <strong>URIs de redirecionamento autorizados</strong>, adicione:</li>
              </ol>
              <div className="flex items-center gap-1 ml-4">
                <Input
                  value={redirectUri}
                  readOnly
                  className="text-xs font-mono bg-background h-7 flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7"
                  onClick={() => copyToClipboard(redirectUri)}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="rounded border border-destructive/30 bg-destructive/5 p-2 mt-2">
                <p className="text-xs text-destructive flex items-start gap-1">
                  <span className="mt-0.5">⚠</span>
                  <span>
                    Se o app estiver em modo <strong>Testing</strong>, adicione seu e-mail como <strong>Usuário de teste</strong> em OAuth consent screen → Test users.
                  </span>
                </p>
              </div>
            </div>

            {/* Credential fields */}
            <div className="space-y-1.5">
              <Label htmlFor="client-id">Client ID *</Label>
              <Input
                id="client-id"
                placeholder="xxxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setCredentialsSaved(false); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-secret">Client Secret *</Label>
              <Input
                id="client-secret"
                type="password"
                placeholder="GOCSPX-xxxxxxxx"
                value={clientSecret}
                onChange={(e) => { setClientSecret(e.target.value); setCredentialsSaved(false); }}
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {!credentialsSaved ? (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Salvar Credenciais
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Credenciais salvas
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Fechar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Atualizar Credenciais
                    </Button>
                    <Button onClick={handleConnect} className="bg-gradient-primary">
                      Conectar ao Google →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
