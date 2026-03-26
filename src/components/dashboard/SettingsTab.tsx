import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Webhook, Calendar, Bell, Shield, Smartphone, Plus, Power, QrCode, Wifi, WifiOff, Activity } from "lucide-react";
import TelegramBotsSection from "@/components/settings/TelegramBotsSection";
import { toast } from "sonner";
import { useWhatsAppInboxes } from "@/hooks/useWhatsApp";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface InstanceStatus {
  state: string;
  loading: boolean;
}

interface DowntimeLog {
  id: string;
  instance_name: string;
  down_at: string;
  up_at: string | null;
  duration_seconds: number | null;
}

const SettingsTab = () => {
  const { profile } = useAuth();
  const { inboxes, loading: inboxesLoading, createInbox, toggleInbox } = useWhatsAppInboxes();

  const [showAddInbox, setShowAddInbox] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingInbox, setSavingInbox] = useState(false);

  // QR Code state
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceLabel, setQrInstanceLabel] = useState("");

  // Instance statuses
  const [statuses, setStatuses] = useState<Record<string, InstanceStatus>>({});

  // Downtime logs
  const [downtimeLogs, setDowntimeLogs] = useState<DowntimeLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const checkInstanceStatus = useCallback(async (instanceName: string, inboxId: string) => {
    setStatuses(prev => ({ ...prev, [inboxId]: { state: prev[inboxId]?.state || "unknown", loading: true } }));
    try {
      const { data, error } = await supabase.functions.invoke("evolution-instance-status", {
        body: { action: "status", instanceName },
      });
      if (error) throw error;
      const state = data?.state || "unknown";
      setStatuses(prev => ({ ...prev, [inboxId]: { state, loading: false } }));

      // Log downtime if status changed
      if (profile?.clinic_id) {
        const prevState = statuses[inboxId]?.state;
        if (prevState && prevState !== state) {
          if (state !== "open" && prevState === "open") {
            // went down
            await supabase.functions.invoke("evolution-instance-status", {
              body: { action: "log_downtime", instanceName, inboxId, clinicId: profile.clinic_id },
            });
          } else if (state === "open" && prevState !== "open") {
            // came back up
            await supabase.functions.invoke("evolution-instance-status", {
              body: { action: "log_downtime", instanceName, inboxId, clinicId: profile.clinic_id },
            });
          }
        }
      }
    } catch {
      setStatuses(prev => ({ ...prev, [inboxId]: { state: "error", loading: false } }));
    }
  }, [profile?.clinic_id, statuses]);

  const fetchDowntimeLogs = useCallback(async () => {
    if (!profile?.clinic_id) return;
    setLoadingLogs(true);
    try {
      const { data } = await supabase
        .from("instance_downtime_logs" as any)
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("down_at", { ascending: false })
        .limit(20);
      setDowntimeLogs((data as any as DowntimeLog[]) || []);
    } catch {
      console.error("Error fetching downtime logs");
    } finally {
      setLoadingLogs(false);
    }
  }, [profile?.clinic_id]);

  // Check all instance statuses on mount
  useEffect(() => {
    if (inboxes.length > 0) {
      inboxes.forEach(inbox => checkInstanceStatus(inbox.instance_name, inbox.id));
    }
  }, [inboxes.length]);

  useEffect(() => {
    fetchDowntimeLogs();
  }, [fetchDowntimeLogs]);

  // Poll statuses every 30s
  useEffect(() => {
    if (inboxes.length === 0) return;
    const interval = setInterval(() => {
      inboxes.forEach(inbox => checkInstanceStatus(inbox.instance_name, inbox.id));
    }, 30000);
    return () => clearInterval(interval);
  }, [inboxes]);

  const handleSave = () => {
    toast.success("Configurações salvas com sucesso!");
  };

  const handleAddInbox = async () => {
    if (!newInstanceName.trim() || !newLabel.trim()) {
      toast.error("Preencha o nome da instância e o label");
      return;
    }
    if (!profile?.clinic_id) {
      toast.error("Clínica não encontrada");
      return;
    }
    setSavingInbox(true);
    try {
      await createInbox({
        instance_name: newInstanceName.trim(),
        label: newLabel.trim(),
        phone_number: newPhone.trim() || undefined,
        clinic_id: profile.clinic_id,
      });
      toast.success("Instância adicionada com sucesso!");
      setNewLabel("");
      setNewInstanceName("");
      setNewPhone("");
      setShowAddInbox(false);
    } catch (error: any) {
      toast.error("Erro ao adicionar instância: " + error.message);
    } finally {
      setSavingInbox(false);
    }
  };

  const handleToggleInbox = async (id: string, currentActive: boolean) => {
    try {
      await toggleInbox(id, !currentActive);
      toast.success(currentActive ? "Instância desativada" : "Instância ativada");
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const handleGenerateQR = async (instanceName: string, label: string) => {
    setQrInstanceLabel(label);
    setQrDialogOpen(true);
    setQrLoading(true);
    setQrData(null);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-instance-status", {
        body: { action: "qrcode", instanceName },
      });
      if (error) throw error;
      // Evolution API returns base64 or qrcode object
      const base64 = data?.base64 || data?.qrcode?.base64 || null;
      setQrData(base64);
      if (!base64) {
        toast.info("A instância já está conectada ou não retornou QR Code.");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar QR Code: " + err.message);
    } finally {
      setQrLoading(false);
    }
  };

  const getStatusBadge = (inboxId: string, isActive: boolean) => {
    if (!isActive) return <Badge variant="secondary">Inativo</Badge>;
    const status = statuses[inboxId];
    if (!status || status.loading) return <Badge variant="outline" className="animate-pulse">Verificando...</Badge>;
    if (status.state === "open") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200"><Wifi className="w-3 h-3 mr-1" />Online</Badge>;
    if (status.state === "close" || status.state === "connecting") return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" />Offline</Badge>;
    return <Badge variant="secondary">Desconhecido</Badge>;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}min`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Instâncias WhatsApp */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Instâncias WhatsApp (Evolution API)
          </CardTitle>
          <CardDescription>
            Gerencie os números de WhatsApp conectados à sua clínica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {inboxesLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              {inboxes.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Instância</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Conexão</TableHead>
                      <TableHead className="w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inboxes.map((inbox) => (
                      <TableRow key={inbox.id}>
                        <TableCell className="font-medium">{inbox.label}</TableCell>
                        <TableCell className="font-mono text-xs">{inbox.instance_name}</TableCell>
                        <TableCell>{inbox.phone_number || "—"}</TableCell>
                        <TableCell>{getStatusBadge(inbox.id, inbox.is_active)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleGenerateQR(inbox.instance_name, inbox.label)}
                              title="Gerar QR Code"
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => checkInstanceStatus(inbox.instance_name, inbox.id)}
                              title="Verificar status"
                            >
                              <Activity className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleInbox(inbox.id, inbox.is_active)}
                              title={inbox.is_active ? "Desativar" : "Ativar"}
                            >
                              <Power className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {inboxes.length === 0 && !showAddInbox && (
                <p className="text-sm text-muted-foreground">Nenhuma instância cadastrada.</p>
              )}

              {showAddInbox ? (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm">Nova Instância</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="new-label">Label *</Label>
                      <Input id="new-label" placeholder="Ex: Recepção" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-instance">Instance Name *</Label>
                      <Input id="new-instance" placeholder="Ex: demo-nw-1" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-phone">Telefone</Label>
                      <Input id="new-phone" placeholder="Ex: 5511999999999" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddInbox} disabled={savingInbox} size="sm">
                      {savingInbox ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowAddInbox(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowAddInbox(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Instância
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Monitor de Quedas */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Monitor de Disponibilidade
          </CardTitle>
          <CardDescription>
            Histórico de quedas e indisponibilidades das instâncias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : downtimeLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma queda registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instância</TableHead>
                  <TableHead>Início da Queda</TableHead>
                  <TableHead>Retorno</TableHead>
                  <TableHead>Tempo Fora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {downtimeLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.instance_name}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(log.down_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.up_at ? (
                        new Date(log.up_at).toLocaleString("pt-BR")
                      ) : (
                        <Badge variant="destructive">Ainda fora</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {log.duration_seconds ? (
                        formatDuration(log.duration_seconds)
                      ) : (
                        <span className="text-destructive">Em andamento</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Integração N8N */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Integração N8N (WhatsApp)
          </CardTitle>
          <CardDescription>
            Configure a conexão com seu webhook N8N para receber e enviar mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL do Webhook N8N</Label>
            <Input id="webhook-url" placeholder="https://seu-n8n.com/webhook/..." defaultValue="https://n8n-nw.nicwalsolutions.com.br/webhook/evo-api-nw-5511967373819" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-key">API Key Evolution</Label>
            <Input id="webhook-key" type="password" placeholder="••••••••••••••••" defaultValue="E59A505A322C-47E0-9471-951A8D54F3FE" />
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="webhook-active" defaultChecked />
            <Label htmlFor="webhook-active">Webhook ativo</Label>
          </div>
        </CardContent>
      </Card>

      {/* Integração Google Calendar */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Conecte sua conta do Google para sincronizar agendamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calendar-id">ID do Calendário</Label>
            <Input id="calendar-id" placeholder="seuemail@gmail.com" defaultValue="a4b9ede547918b89a0a778f1cb35ae2ded39a87f47094089c65fd5add@group.calendar.google.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key do Google</Label>
            <Input id="api-key" type="password" placeholder="••••••••••••••••" defaultValue="60e835c2e73b9de0f9aab71554b1565d92374bf7" />
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="calendar-sync" defaultChecked />
            <Label htmlFor="calendar-sync">Sincronização automática</Label>
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configure como você deseja receber notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Novas mensagens</Label>
              <p className="text-sm text-muted-foreground">Receber notificação para cada nova mensagem</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Novos agendamentos</Label>
              <p className="text-sm text-muted-foreground">Notificar sobre novos eventos na agenda</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Relatórios diários</Label>
              <p className="text-sm text-muted-foreground">Receber resumo diário por email</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Segurança
          </CardTitle>
          <CardDescription>
            Gerencie as configurações de segurança da sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Senha Atual</Label>
            <Input id="current-password" type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <Input id="new-password" type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
            <Input id="confirm-password" type="password" placeholder="••••••••" />
          </div>
        </CardContent>
      </Card>

      {/* Botão de salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-gradient-primary shadow-card">
          Salvar Configurações
        </Button>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              QR Code — {qrInstanceLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            {qrLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : qrData ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`}
                  alt="QR Code"
                  className="w-64 h-64 rounded-lg border"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie este QR Code.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <Wifi className="w-10 h-10 text-emerald-500" />
                <p className="text-sm text-muted-foreground text-center">
                  A instância já está conectada ou não retornou um QR Code.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsTab;
