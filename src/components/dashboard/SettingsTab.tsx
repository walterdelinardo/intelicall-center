import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Webhook, Calendar, Bell, Shield, Smartphone, Plus, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { useWhatsAppInboxes } from "@/hooks/useWhatsApp";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const SettingsTab = () => {
  const { profile } = useAuth();
  const { inboxes, loading: inboxesLoading, createInbox, toggleInbox } = useWhatsAppInboxes();

  const [showAddInbox, setShowAddInbox] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingInbox, setSavingInbox] = useState(false);

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
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inboxes.map((inbox) => (
                      <TableRow key={inbox.id}>
                        <TableCell className="font-medium">{inbox.label}</TableCell>
                        <TableCell className="font-mono text-xs">{inbox.instance_name}</TableCell>
                        <TableCell>{inbox.phone_number || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={inbox.is_active ? "default" : "secondary"}>
                            {inbox.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleInbox(inbox.id, inbox.is_active)}
                            title={inbox.is_active ? "Desativar" : "Ativar"}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
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
                      <Input
                        id="new-label"
                        placeholder="Ex: Recepção"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-instance">Instance Name *</Label>
                      <Input
                        id="new-instance"
                        placeholder="Ex: demo-nw-1"
                        value={newInstanceName}
                        onChange={(e) => setNewInstanceName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-phone">Telefone</Label>
                      <Input
                        id="new-phone"
                        placeholder="Ex: 5511999999999"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                      />
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
            <Input
              id="webhook-url"
              placeholder="https://seu-n8n.com/webhook/..."
              defaultValue="https://n8n-nw.nicwalsolutions.com.br/webhook/evo-api-nw-5511967373819"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-key">API Key Evolution</Label>
            <Input
              id="webhook-key"
              type="password"
              placeholder="••••••••••••••••"
              defaultValue="E59A505A322C-47E0-9471-951A8D54F3FE"
            />
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
            <Input
              id="calendar-id"
              placeholder="seuemail@gmail.com"
              defaultValue="a4b9ede547918b89a0a778f1cb35ae2ded39a87f47094089c65fd5add@group.calendar.google.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key do Google</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="••••••••••••••••"
              defaultValue="60e835c2e73b9de0f9aab71554b1565d92374bf7"
            />
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
    </div>
  );
};

export default SettingsTab;
