import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Webhook, Calendar, Bell, Shield } from "lucide-react";
import { toast } from "sonner";

const SettingsTab = () => {
  const handleSave = () => {
    toast.success("Configurações salvas com sucesso!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
            <Label htmlFor="webhook-url">URL do Webhook</Label>
            <Input
              id="webhook-url"
              placeholder="https://seu-n8n.com/webhook/..."
              defaultValue="https://exemplo.n8n.cloud/webhook/whatsapp"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-key">Chave de Autenticação</Label>
            <Input
              id="webhook-key"
              type="password"
              placeholder="••••••••••••••••"
              defaultValue="abc123def456"
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
              defaultValue="atendimento@empresa.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key do Google</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="••••••••••••••••"
              defaultValue="AIzaSy..."
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
