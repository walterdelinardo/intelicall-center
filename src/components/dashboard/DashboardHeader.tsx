import { Bell, LogOut, Building2, Check, CircleCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  recepcao: "Recepção",
  podologo: "Podólogo",
  financeiro: "Financeiro",
};

const notifIcons: Record<string, string> = {
  created: "🆕",
  updated: "✏️",
  rescheduled: "📅",
  cancelled: "❌",
};

const DashboardHeader = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, roles, signOut } = useAuth();

  const { data: clinic } = useQuery({
    queryKey: ["clinic-header", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return null;
      const { data } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", profile.clinic_id)
        .single();
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: notifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ["header-notifications", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data } = await supabase
        .from("calendar_notifications" as any)
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!profile?.clinic_id,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const toggleRead = async (id: string, currentRead: boolean) => {
    await supabase.from("calendar_notifications").update({ is_read: !currentRead } as any).eq("id", id);
    refetchNotifications();
    queryClient.invalidateQueries({ queryKey: ["calendar-notifications"] });
  };

  const toggleImportant = async (id: string, currentImportant: boolean) => {
    await supabase.from("calendar_notifications").update({ is_important: !currentImportant } as any).eq("id", id);
    refetchNotifications();
    queryClient.invalidateQueries({ queryKey: ["calendar-notifications"] });
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n: any) => !n.is_read);
    for (const n of unread) {
      await supabase.from("calendar_notifications").update({ is_read: true } as any).eq("id", (n as any).id);
    }
    refetchNotifications();
    queryClient.invalidateQueries({ queryKey: ["calendar-notifications"] });
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/");
  };

  return (
    <header className="border-b bg-card shadow-sm sticky top-0 z-50">
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Clinic info */}
        <div className="flex items-center gap-3 min-w-0">
          {clinic?.logo_url ? (
            <img src={clinic.logo_url} alt={clinic.name} className="w-9 h-9 rounded-lg object-cover border border-border" />
          ) : (
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">{clinic?.name || "Clínica"}</h1>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {clinic?.address && <span className="truncate max-w-[200px]">{clinic.address}</span>}
              {(clinic as any)?.cnpj && (
                <>
                  {clinic?.address && <span>•</span>}
                  <span>{(clinic as any).cnpj}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: User info + notifications + logout */}
        <div className="flex items-center gap-3 shrink-0">
          {/* User info */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium">{profile?.full_name || "Usuário"}</span>
            <div className="flex gap-1">
              {roles.map((r) => (
                <Badge key={r} variant="outline" className="text-[10px] h-4 px-1.5">
                  {roleLabels[r] || r}
                </Badge>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                ) : (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold">Notificações da Agenda</p>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={markAllRead}>
                    Marcar todas como lidas
                  </Button>
                )}
              </div>
              <ScrollArea className="max-h-80">
                {notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notificação</p>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((n: any) => (
                      <div key={n.id} className={`px-3 py-2.5 transition-colors ${n.is_read ? "opacity-60" : "bg-primary/5"} ${n.is_important ? "border-l-2 border-l-yellow-500" : ""}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-sm mt-0.5">{notifIcons[n.action] || "📋"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{n.event_title}</p>
                            {n.details && <p className="text-[11px] text-muted-foreground truncate">{n.details}</p>}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })} — {n.actor_name || "Sistema"}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title={n.is_read ? "Marcar como não lida" : "Marcar como lida"}
                              onClick={() => toggleRead(n.id, n.is_read)}
                            >
                              <CircleCheck className={`w-3.5 h-3.5 ${n.is_read ? "text-green-500" : "text-muted-foreground"}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title={n.is_important ? "Remover importância" : "Marcar como importante"}
                              onClick={() => toggleImportant(n.id, n.is_important)}
                            >
                              <AlertCircle className={`w-3.5 h-3.5 ${n.is_important ? "text-yellow-500" : "text-muted-foreground"}`} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Logout */}
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
