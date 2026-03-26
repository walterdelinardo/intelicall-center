import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Check, CheckCheck, MessageSquare, PackageCheck, BarChart3, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface TelegramNotification {
  id: string;
  clinic_id: string;
  bot_id: string;
  message: string;
  direction: string;
  notification_type: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
}

interface TelegramBotInfo {
  id: string;
  label: string;
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
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.clinic_id) return;
    setLoading(true);
    try {
      const [notifRes, botsRes] = await Promise.all([
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
      ]);

      setNotifications((notifRes.data as any as TelegramNotification[]) || []);

      const botsMap: Record<string, TelegramBotInfo> = {};
      ((botsRes.data as any as TelegramBotInfo[]) || []).forEach(b => {
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
    try {
      await supabase
        .from("telegram_notifications" as any)
        .update({ is_read: true } as any)
        .eq("id", id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      console.error("Error marking notification as read");
    }
  };

  const markAllAsRead = async () => {
    if (!profile?.clinic_id) return;
    try {
      await supabase
        .from("telegram_notifications" as any)
        .update({ is_read: true } as any)
        .eq("clinic_id", profile.clinic_id)
        .eq("is_read", false);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      console.error("Error marking all as read");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Carregando notificações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
          <Button variant="ghost" size="sm" onClick={fetchData} title="Atualizar">
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
            <p className="text-sm text-muted-foreground">
              Nenhuma notificação recebida ainda.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure um bot na aba Configurações → Integrações para começar a receber.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`transition-colors ${!notif.is_read ? "border-primary/30 bg-primary/5" : ""}`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5">
                      {typeIcons[notif.notification_type] || <Bot className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-xs">
                          {typeLabels[notif.notification_type] || notif.notification_type}
                        </Badge>
                        {bots[notif.bot_id] && (
                          <span className="text-xs text-muted-foreground">
                            via {bots[notif.bot_id].label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notif.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  {!notif.is_read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => markAsRead(notif.id)}
                      title="Marcar como lida"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TelegramNotificationsTab;
