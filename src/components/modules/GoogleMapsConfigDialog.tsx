import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface GoogleMapsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export const GoogleMapsConfigDialog = ({ open, onOpenChange, onSaved }: GoogleMapsConfigDialogProps) => {
  const { profile } = useAuth();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);

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
        .from("clinics")
        .select("google_maps_api_key")
        .eq("id", profile!.clinic_id!)
        .single();

      if (!error && data) {
        const stored = (data as any).google_maps_api_key;
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setClientId(parsed.client_id || "");
            setClientSecret(parsed.client_secret || "");
            setCredentialsSaved(true);
          } catch {
            // Legacy: simple API key stored
            setClientId(stored);
            setClientSecret("");
            setCredentialsSaved(true);
          }
        } else {
          setClientId("");
          setClientSecret("");
          setCredentialsSaved(false);
        }
      }
    } catch (e) {
      console.error("Error loading Google Maps config:", e);
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
      const configValue = JSON.stringify({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      });

      const { error } = await supabase
        .from("clinics")
        .update({ google_maps_api_key: configValue } as any)
        .eq("id", profile.clinic_id);
      if (error) throw error;

      toast.success("Credenciais do Google Maps salvas!");
      setCredentialsSaved(true);
      onSaved();
    } catch (error: any) {
      console.error("Error saving Google Maps config:", error);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">🗺️</span>
            Configurar Google Maps API
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure as credenciais OAuth 2.0 do Google Cloud Console para cálculos de distância e logística.
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
                <li>Use o mesmo projeto do Google Calendar (ou crie um novo)</li>
                <li>Ative as APIs: <a href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Maps JavaScript API <ExternalLink className="w-2.5 h-2.5" /></a> e <a href="https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Distance Matrix API <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Crie credenciais → <strong>ID do cliente OAuth 2.0</strong> (tipo: Aplicativo Web)</li>
                <li>Copie o <strong>Client ID</strong> e <strong>Client Secret</strong> abaixo</li>
              </ol>
              <div className="rounded border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-2 mt-2">
                <p className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-1">
                  <span className="mt-0.5">💡</span>
                  <span>
                    Você pode reutilizar as mesmas credenciais do Google Calendar se já as configurou.
                  </span>
                </p>
              </div>
            </div>

            {/* Credential fields */}
            <div className="space-y-1.5">
              <Label htmlFor="maps-client-id">Client ID *</Label>
              <Input
                id="maps-client-id"
                placeholder="xxxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setCredentialsSaved(false); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maps-client-secret">Client Secret *</Label>
              <Input
                id="maps-client-secret"
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