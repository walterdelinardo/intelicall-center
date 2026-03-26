import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot, CheckCheck, MessageSquare, PackageCheck, BarChart3,
  RefreshCw, Download, Loader2, CircleCheck, CircleDashed,
  Send,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TelegramLabelPicker from "./TelegramLabelPicker";

interface TelegramNotification {
  id: string;
  clinic_id: string;
  bot_id: string;
  message: string;
  direction: string;
  notification_type: string;
  is_read: boolean;
  is_ok: boolean;
  metadata: any;
  created_at: string;
}

interface TelegramBotInfo {
  id: string;
  label: string;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface NotifLabelAssignment {
  notification_id: string;
  label_id: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  message: <MessageSquare className="w-4 h-4 text-blue-500" />,
  stock_alert: <PackageCheck className="w-4 h-4 text-amber-500" />,
  financial_report: <BarChart3 className="w-4 h-4 text-emerald-500" />,
};

const typeLabels: Record<string, string> = {
  message: "Mensagem",
  stock_alert: "Estoque Baixo",
  financial_report: "Relatório Financeiro",
};

const TelegramNotificationsTab = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<TelegramNotification[]>([]);
  const [bots, setBots] = useState<Record<string, TelegramBotInfo>>({});
  const [labels, setLabels] = useState<Label[]>([]);
  const [assignments, setAssignments] = useState<NotifLabelAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.clinic_id) return;
    setLoading(true);
    try {
      const [notifRes, botsRes, labelsRes, assignRes] = await Promise.all([
        supabase
          .from("telegram_notifications" as any)
          .select("*")
          .eq("clinic_id", profile.clinic_id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("telegram_bots" as any)
          .select("id, label")
          .eq("clinic_id", profile.clinic_id),
        supabase
          .from("telegram_labels" as any)
          .select("id, name, color")
          .eq("clinic_id", profile.clinic_id),
        supabase
          .from("telegram_notification_labels" as any)
          .select("notification_id, label_id"),
      ]);

      setNotifications((notifRes.data as any as TelegramNotification[]) || []);
      setLabels((labelsRes.data as any as Label[]) || []);
      setAssignments((assignRes.data as any as NotifLabelAssignment[]) || []);

      const botsMap: Record<string, TelegramBotInfo> = {};
      ((botsRes.data as any as TelegramBotInfo[]) || []).forEach((b) => {
        botsMap[b.id] = b;
      });
      setBots(botsMap);
    } catch {
      console.error("Error fetching telegram notifications");
    } finally {
      setLoading(false);
    }
  }, [profile?.clinic_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.clinic_id) return;

    const channel = supabase
      .channel("telegram-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "telegram_notifications",
          filter: `clinic_id=eq.${profile.clinic_id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as any as TelegramNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.clinic_id]);

  const markAsRead = async (id: string) => {
    await supabase.from("telegram_notifications" as any).update({ is_read: true } as any).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!profile?.clinic_id) return;
    await supabase.from("telegram_notifications" as any).update({ is_read: true } as any).eq("clinic_id", profile.clinic_id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const toggleOk = async (id: string, currentOk: boolean) => {
    const newOk = !currentOk;
    const updates: any = { is_ok: newOk };
    if (newOk) updates.is_read = true;
    await supabase.from("telegram_notifications" as any).update(updates).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_ok: newOk, ...(newOk ? { is_read: true } : {}) } : n)));
  };

  const handleForceSync = async () => {
    if (!profile?.clinic_id) return;
    setSyncing(true);
    try {
      const { data: botsList } = await supabase
        .from("telegram_bots" as any)
        .select("id")
        .eq("clinic_id", profile.clinic_id)
        .eq("is_active", true);

      if (!botsList || botsList.length === 0) {
        toast.error("Nenhum bot ativo encontrado");
        return;
      }

      let totalSynced = 0;
      for (const bot of botsList as any[]) {
        const { data } = await supabase.functions.invoke("telegram-sync", {
          body: { botId: bot.id },
        });
        if (data?.ok) totalSynced += data.synced || 0;
      }

      toast.success(`Sincronizado! ${totalSynced} nova(s) mensagem(ns)`);
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const getAssignedLabelIds = (notifId: string) =>
    assignments.filter((a) => a.notification_id === notifId).map((a) => a.label_id);

  const getAssignedLabels = (notifId: string) => {
    const ids = getAssignedLabelIds(notifId);
    return labels.filter((l) => ids.includes(l.id));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Notificações Telegram</h3>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount} não lida{unreadCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleForceSync}
            disabled={syncing}
            title="Forçar sincronização manual"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
            Sincronizar
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchData} title="Atualizar lista">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação recebida ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">
              As mensagens do grupo Telegram serão sincronizadas automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const notifLabels = getAssignedLabels(notif.id);
            return (
              <Card
                key={notif.id}
                className={`transition-colors ${!notif.is_read ? "border-primary/30 bg-primary/5" : ""} ${notif.is_ok ? "opacity-60" : ""}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">
                        {typeIcons[notif.notification_type] || <Bot className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {typeLabels[notif.notification_type] || notif.notification_type}
                          </Badge>
                          {bots[notif.bot_id] && (
                            <span className="text-xs text-muted-foreground">via {bots[notif.bot_id].label}</span>
                          )}
                          {notifLabels.map((l) => (
                            <Badge
                              key={l.id}
                              className="text-[10px] h-4 px-1.5 text-white border-0"
                              style={{ backgroundColor: l.color }}
                            >
                              {l.name}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{notif.message}</p>
                        {notif.metadata?.from && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            De: {notif.metadata.from.first_name} {notif.metadata.from.last_name || ""}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notif.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {/* Ok toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleOk(notif.id, notif.is_ok)}
                        title={notif.is_ok ? "Desmarcar Ok" : "Marcar como Ok"}
                      >
                        {notif.is_ok ? (
                          <CircleCheck className="w-4 h-4 text-green-500" />
                        ) : (
                          <CircleDashed className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>

                      {/* Label picker */}
                      <TelegramLabelPicker
                        notificationId={notif.id}
                        assignedLabelIds={getAssignedLabelIds(notif.id)}
                        allLabels={labels}
                        onLabelsChanged={fetchData}
                      />

                      {/* Removed mark as read button */}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TelegramNotificationsTab;
