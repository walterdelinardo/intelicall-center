import { Bell, LogOut, Building2, MessageSquare, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";


const notifIcons: Record<string, string> = {
  created: "🆕",
  updated: "✏️",
  rescheduled: "📅",
  cancelled: "❌",
};

const DashboardHeader = () => {
  const navigate = useNavigate();
  
  const { profile, assignedRoles, signOut } = useAuth();
  const { setActiveModule, openConversasTab, openAgendaTab } = useDashboard();

  const { data: clinic } = useQuery({
    queryKey: ["clinic-header", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return null;
      const { data } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", profile.clinic_id)
        .single();
      // Save logo to localStorage for login page & favicon
      if (data?.logo_url) localStorage.setItem("clinic_logo_url", data.logo_url);
      if (data?.name) localStorage.setItem("clinic_name", data.name);
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  // Dynamic favicon
  useEffect(() => {
    if (clinic?.logo_url) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = clinic.logo_url;
    }
  }, [clinic?.logo_url]);

  // Agenda notifications
  const { data: notifications = [] } = useQuery({
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

  // WhatsApp unread count
  const { data: whatsappUnread = 0 } = useQuery({
    queryKey: ["header-whatsapp-unread", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return 0;
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("unread_count")
        .eq("clinic_id", profile.clinic_id)
        .gt("unread_count", 0);
      return (data || []).reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0);
    },
    enabled: !!profile?.clinic_id,
    refetchInterval: 15000,
  });

  // Telegram pending (not OK) count
  const { data: telegramUnread = 0 } = useQuery({
    queryKey: ["header-telegram-unread", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return 0;
      const { count } = await supabase
        .from("telegram_notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id)
        .eq("is_ok", false);
      return count || 0;
    },
    enabled: !!profile?.clinic_id,
    refetchInterval: 15000,
  });

  const agendaUnread = notifications.filter((n: any) => !n.is_read).length;

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/");
  };

  const NotifBadge = ({ count }: { count: number }) =>
    count > 0 ? (
      <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

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

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          {/* User info */}
          <div className="hidden sm:flex flex-col items-end mr-1">
            <span className="text-sm font-medium">{profile?.full_name || "Usuário"}</span>
            <div className="flex gap-1">
              {assignedRoles.map((r) => (
                <Badge key={r.id} variant="outline" className="text-[10px] h-4 px-1.5" style={{ borderColor: r.color, color: r.color }}>
                  {r.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* 1. Agenda notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            title="Notificações da Agenda"
            onClick={() => openAgendaTab("notificacoes")}
          >
            <Bell className="w-5 h-5" />
            <NotifBadge count={agendaUnread} />
          </Button>

          {/* 2. WhatsApp unread */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            title="Mensagens WhatsApp não lidas"
            onClick={() => setActiveModule("conversas")}
          >
            <MessageSquare className="w-5 h-5" />
            <NotifBadge count={whatsappUnread} />
          </Button>

          {/* 3. Telegram unread */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            title="Notificações Telegram não lidas"
            onClick={() => openConversasTab("telegram")}
          >
            <Bot className="w-5 h-5" />
            <NotifBadge count={telegramUnread} />
          </Button>

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
