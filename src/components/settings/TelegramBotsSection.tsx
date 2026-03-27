import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Power, Trash2, MessageSquare, PackageCheck, BarChart3, Copy, Terminal, Loader2, RefreshCw, Database } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface TelegramBot {
  id: string;
  clinic_id: string;
  label: string;
  bot_token: string;
  chat_id: string;
  webhook_receive_messages: boolean;
  webhook_stock_alerts: boolean;
  webhook_financial_reports: boolean;
  is_active: boolean;
  created_at: string;
}

const TelegramBotsSection = () => {
  const { profile } = useAuth();
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [curlBotId, setCurlBotId] = useState<string | null>(null);
  const [curlStartDate, setCurlStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [curlEndDate, setCurlEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  const [syncLoading, setSyncLoading] = useState<string | null>(null);
  const [getTable, setGetTable] = useState("stock_items");

  const [newLabel, setNewLabel] = useState("");
  const [newToken, setNewToken] = useState("");
  const [newChatId, setNewChatId] = useState("");
  const [newWebhookMessages, setNewWebhookMessages] = useState(false);
  const [newWebhookStock, setNewWebhookStock] = useState(false);
  const [newWebhookFinancial, setNewWebhookFinancial] = useState(false);

  const fetchBots = useCallback(async () => {
    if (!profile?.clinic_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("telegram_bots" as any)
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBots((data as any as TelegramBot[]) || []);
    } catch {
      console.error("Error fetching telegram bots");
    } finally {
      setLoading(false);
    }
  }, [profile?.clinic_id]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const handleAdd = async () => {
    if (!newLabel.trim() || !newToken.trim() || !newChatId.trim()) {
      toast.error("Preencha o label, token e Chat ID");
      return;
    }
    if (!profile?.clinic_id) {
      toast.error("Clínica não encontrada");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("telegram_bots" as any).insert({
        clinic_id: profile.clinic_id,
        label: newLabel.trim(),
        bot_token: newToken.trim(),
        chat_id: newChatId.trim(),
        webhook_receive_messages: newWebhookMessages,
        webhook_stock_alerts: newWebhookStock,
        webhook_financial_reports: newWebhookFinancial,
      } as any);
      if (error) throw error;
      toast.success("Bot Telegram adicionado!");
      setNewLabel("");
      setNewToken("");
      setNewChatId("");
      setNewWebhookMessages(false);
      setNewWebhookStock(false);
      setNewWebhookFinancial(false);
      setShowAdd(false);
      fetchBots();
    } catch (err: any) {
      toast.error("Erro ao adicionar bot: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("telegram_bots" as any)
        .update({ is_active: !currentActive } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success(currentActive ? "Bot desativado" : "Bot ativado");
      fetchBots();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este bot?")) return;
    try {
      const { error } = await supabase
        .from("telegram_bots" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Bot removido");
      fetchBots();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleToggleWebhook = async (id: string, field: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("telegram_bots" as any)
        .update({ [field]: !currentValue } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Webhook atualizado");
      // Show cURL panel when enabling financial or stock webhook
      if (!currentValue && (field === "webhook_financial_reports" || field === "webhook_stock_alerts")) {
        setCurlBotId(id);
      }
      fetchBots();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };


  const handleSync = async (bot: TelegramBot) => {
    setSyncLoading(bot.id);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-sync", {
        body: { botId: bot.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`Sincronizado! ${data.synced} nova(s) mensagem(ns)`);
      } else {
        toast.error("Falha na sincronização: " + JSON.stringify(data));
      }
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSyncLoading(null);
    }
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/telegram-webhook`;

  const getFinancialCurl = () => `curl -X POST \\
  ${baseUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "financial_report",
    "clinicId": "${profile?.clinic_id || "<clinic_id>"}",
    "period": {
      "startDate": "${curlStartDate}",
      "endDate": "${curlEndDate}"
    }
  }'`;

  const getStockCurl = () => `curl -X POST \\
  ${baseUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "stock_alert",
    "clinicId": "${profile?.clinic_id || "<clinic_id>"}"
  }'`;

  const getN8nCurl = () => `curl -X POST \\
  ${baseUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "n8n_telegram_log",
    "clinicId": "${profile?.clinic_id || "<clinic_id>"}",
    "payload": {{ $json }}
  }'`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("cURL copiado!");
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Bots Telegram
        </CardTitle>
        <CardDescription>
          Configure bots do Telegram para receber mensagens, alertas de estoque e relatórios financeiros
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            {bots.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Chat ID</TableHead>
                    <TableHead>Webhooks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bots.map((bot) => (
                    <TableRow key={bot.id}>
                      <TableCell className="font-medium">{bot.label}</TableCell>
                      <TableCell className="font-mono text-xs">{bot.chat_id}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant={bot.webhook_receive_messages ? "default" : "outline"}
                            className={`cursor-pointer text-xs ${bot.webhook_receive_messages ? "bg-blue-500/15 text-blue-600 border-blue-200 hover:bg-blue-500/25" : ""}`}
                            onClick={() => handleToggleWebhook(bot.id, "webhook_receive_messages", bot.webhook_receive_messages)}
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Mensagens
                          </Badge>
                          <Badge
                            variant={bot.webhook_stock_alerts ? "default" : "outline"}
                            className={`cursor-pointer text-xs ${bot.webhook_stock_alerts ? "bg-amber-500/15 text-amber-600 border-amber-200 hover:bg-amber-500/25" : ""}`}
                            onClick={() => handleToggleWebhook(bot.id, "webhook_stock_alerts", bot.webhook_stock_alerts)}
                          >
                            <PackageCheck className="w-3 h-3 mr-1" />
                            Estoque
                          </Badge>
                          <Badge
                            variant={bot.webhook_financial_reports ? "default" : "outline"}
                            className={`cursor-pointer text-xs ${bot.webhook_financial_reports ? "bg-emerald-500/15 text-emerald-600 border-emerald-200 hover:bg-emerald-500/25" : ""}`}
                            onClick={() => handleToggleWebhook(bot.id, "webhook_financial_reports", bot.webhook_financial_reports)}
                          >
                            <BarChart3 className="w-3 h-3 mr-1" />
                            Financeiro
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {bot.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSync(bot)}
                            disabled={syncLoading === bot.id}
                            title="Sincronizar mensagens do grupo"
                          >
                            {syncLoading === bot.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurlBotId(curlBotId === bot.id ? null : bot.id)}
                            title="Ver cURL de integração"
                            className={curlBotId === bot.id ? "text-primary" : ""}
                          >
                            <Terminal className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggle(bot.id, bot.is_active)}
                            title={bot.is_active ? "Desativar" : "Ativar"}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(bot.id)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {curlBotId && bots.find(b => b.id === curlBotId) && (
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Comandos de Integração — {bots.find(b => b.id === curlBotId)?.label}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Use estes comandos cURL para integrar com sistemas externos (n8n, Make, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bots.find(b => b.id === curlBotId)?.webhook_financial_reports && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                        Relatório Financeiro
                      </Label>
                      <div className="flex gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Data início</Label>
                          <Input
                            type="date"
                            value={curlStartDate}
                            onChange={e => setCurlStartDate(e.target.value)}
                            className="h-8 text-xs w-36"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Data fim</Label>
                          <Input
                            type="date"
                            value={curlEndDate}
                            onChange={e => setCurlEndDate(e.target.value)}
                            className="h-8 text-xs w-36"
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <pre className="bg-muted text-foreground text-xs p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
                          {getFinancialCurl()}
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-7 w-7"
                          onClick={() => copyToClipboard(getFinancialCurl())}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {bots.find(b => b.id === curlBotId)?.webhook_stock_alerts && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <PackageCheck className="w-3.5 h-3.5 text-amber-500" />
                        Alerta de Estoque Baixo
                      </Label>
                      <div className="relative">
                        <pre className="bg-muted text-foreground text-xs p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
                          {getStockCurl()}
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-7 w-7"
                          onClick={() => copyToClipboard(getStockCurl())}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* n8n Telegram Log — always visible */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-purple-500" />
                      Registrar mensagens do n8n
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Cole no node HTTP Request do n8n, após o node Telegram que envia a mensagem. O <code className="bg-muted px-1 rounded">{"{{ $json }}"}</code> injeta o output automaticamente.
                    </p>
                    <div className="relative">
                      <pre className="bg-muted text-foreground text-xs p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
                        {getN8nCurl()}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-7 w-7"
                        onClick={() => copyToClipboard(getN8nCurl())}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" onClick={() => setCurlBotId(null)}>
                    Fechar
                  </Button>
                </CardContent>
              </Card>
            )}

            {bots.length === 0 && !showAdd && (
              <p className="text-sm text-muted-foreground">Nenhum bot configurado.</p>
            )}

            {showAdd ? (
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium text-sm">Novo Bot Telegram</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Label *</Label>
                    <Input placeholder="Ex: Bot Alertas" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Token do Bot *</Label>
                    <Input type="password" placeholder="123456:ABC-DEF..." value={newToken} onChange={e => setNewToken(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Chat ID *</Label>
                    <Input placeholder="Ex: -1001234567890" value={newChatId} onChange={e => setNewChatId(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="text-sm font-medium text-muted-foreground">Webhooks</h5>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={newWebhookMessages} onCheckedChange={setNewWebhookMessages} />
                      <Label className="flex items-center gap-1.5 cursor-pointer">
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                        Receber Mensagens
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={newWebhookStock} onCheckedChange={setNewWebhookStock} />
                      <Label className="flex items-center gap-1.5 cursor-pointer">
                        <PackageCheck className="w-4 h-4 text-amber-500" />
                        Alertas de Estoque Baixo
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={newWebhookFinancial} onCheckedChange={setNewWebhookFinancial} />
                      <Label className="flex items-center gap-1.5 cursor-pointer">
                        <BarChart3 className="w-4 h-4 text-emerald-500" />
                        Relatórios Financeiros
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAdd} disabled={saving} size="sm">
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar Bot
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TelegramBotsSection;
