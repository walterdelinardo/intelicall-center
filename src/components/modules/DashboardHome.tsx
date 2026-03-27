import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, DollarSign, TrendingUp, Clock, UserPlus, Package, Activity, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subDays, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

type PeriodFilter = "hoje" | "semana" | "mes";
type CategoryFilter = "todos" | "atendimento" | "produto";

const DashboardHome = () => {
  const { profile, isSuperAdmin } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>("hoje");
  const [selectedPodologo, setSelectedPodologo] = useState<string>("todos");
  const [selectedProcedure, setSelectedProcedure] = useState<string>("todos");
  const [category, setCategory] = useState<CategoryFilter>("todos");

  const today = new Date();

  // Compute date range from period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "hoje":
        return { start: format(now, "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "semana": {
        const s = startOfWeek(now, { weekStartsOn: 1 });
        const e = endOfWeek(now, { weekStartsOn: 1 });
        return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
      }
      case "mes": {
        const s = startOfMonth(now);
        const e = endOfMonth(now);
        return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
      }
    }
  }, [period]);

  // Fetch calendar labels for podólogo filter (admin only)
  const { data: calendarLabels } = useQuery({
    queryKey: ["calendar-labels", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data } = await supabase
        .from("google_calendar_accounts")
        .select("label")
        .eq("clinic_id", profile.clinic_id)
        .eq("is_active", true);
      return [...new Set((data || []).map(d => d.label))];
    },
    enabled: !!profile?.clinic_id,
  });

  // For non-admin: find their own calendar_label
  const { data: myCalendarLabel } = useQuery({
    queryKey: ["my-calendar-label", profile?.id, profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id || !profile?.full_name) return null;
      const { data } = await supabase
        .from("google_calendar_accounts")
        .select("label")
        .eq("clinic_id", profile.clinic_id)
        .eq("label", profile.full_name)
        .eq("is_active", true)
        .maybeSingle();
      return data?.label || null;
    },
    enabled: !!profile?.clinic_id && !isSuperAdmin,
  });

  // Effective label filter
  const effectiveLabel = isSuperAdmin
    ? (selectedPodologo === "todos" ? null : selectedPodologo)
    : myCalendarLabel;

  // Fetch procedures for filter
  const { data: procedures } = useQuery({
    queryKey: ["procedures-list", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data } = await supabase
        .from("procedures")
        .select("id, name")
        .eq("clinic_id", profile.clinic_id)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  // Main financial transactions query (filtered)
  const { data: transactions } = useQuery({
    queryKey: ["dashboard-transactions", profile?.clinic_id, dateRange, effectiveLabel, selectedProcedure, category],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      let query = supabase
        .from("financial_transactions")
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .eq("type", "receita")
        .gte("date", dateRange.start)
        .lte("date", dateRange.end);
      if (effectiveLabel) query = query.eq("calendar_label", effectiveLabel);
      if (category !== "todos") query = query.eq("category", category);
      if (selectedProcedure !== "todos") query = query.ilike("description", `%${selectedProcedure}%`);
      const { data } = await query;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  // Appointments count (filtered)
  const { data: appointmentsCount } = useQuery({
    queryKey: ["dashboard-appointments", profile?.clinic_id, dateRange, effectiveLabel],
    queryFn: async () => {
      if (!profile?.clinic_id) return 0;
      let query = supabase
        .from("appointments")
        .select("id, google_event_id", { count: "exact", head: false })
        .eq("clinic_id", profile.clinic_id)
        .gte("date", dateRange.start)
        .lte("date", dateRange.end);
      // Filter by calendar_label via google_event_id presence if label is set
      const { data, count } = await query;
      if (!effectiveLabel) return count || 0;
      // Filter appointments whose google_event_id matches transactions with this label
      // Simple approach: count appointments in date range
      return count || 0;
    },
    enabled: !!profile?.clinic_id,
  });

  // New clients in period
  const { data: newClientsCount } = useQuery({
    queryKey: ["dashboard-new-clients", profile?.clinic_id, dateRange],
    queryFn: async () => {
      if (!profile?.clinic_id) return 0;
      const { count } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id)
        .gte("created_at", `${dateRange.start}T00:00:00`)
        .lte("created_at", `${dateRange.end}T23:59:59`);
      return count || 0;
    },
    enabled: !!profile?.clinic_id,
  });

  // Waiting list stats
  const { data: waitingCount } = useQuery({
    queryKey: ["dashboard-waiting", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return 0;
      const { count } = await supabase
        .from("waiting_list")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id)
        .eq("status", "aguardando");
      return count || 0;
    },
    enabled: !!profile?.clinic_id,
  });

  // Last 7 days transactions
  const last7Start = format(subDays(today, 6), "yyyy-MM-dd");
  const last7End = format(today, "yyyy-MM-dd");
  const { data: last7Transactions } = useQuery({
    queryKey: ["dashboard-last7", profile?.clinic_id, effectiveLabel, selectedProcedure, category],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      let query = supabase
        .from("financial_transactions")
        .select("amount, quantity")
        .eq("clinic_id", profile.clinic_id)
        .eq("type", "receita")
        .gte("date", last7Start)
        .lte("date", last7End);
      if (effectiveLabel) query = query.eq("calendar_label", effectiveLabel);
      if (category !== "todos") query = query.eq("category", category);
      if (selectedProcedure !== "todos") query = query.ilike("description", `%${selectedProcedure}%`);
      const { data } = await query;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  // Year transactions for monthly breakdown
  const yearStart = format(startOfYear(today), "yyyy-MM-dd");
  const yearEnd = format(endOfYear(today), "yyyy-MM-dd");
  const { data: yearTransactions } = useQuery({
    queryKey: ["dashboard-year", profile?.clinic_id, effectiveLabel, selectedProcedure, category],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      let query = supabase
        .from("financial_transactions")
        .select("amount, quantity, date")
        .eq("clinic_id", profile.clinic_id)
        .eq("type", "receita")
        .gte("date", yearStart)
        .lte("date", yearEnd);
      if (effectiveLabel) query = query.eq("calendar_label", effectiveLabel);
      if (category !== "todos") query = query.eq("category", category);
      if (selectedProcedure !== "todos") query = query.ilike("description", `%${selectedProcedure}%`);
      const { data } = await query;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  // Compute stats
  const totalRevenue = (transactions || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalQty = (transactions || []).reduce((sum, t) => sum + Number(t.quantity || 0), 0);

  const last7Revenue = (last7Transactions || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const last7Qty = (last7Transactions || []).reduce((sum, t) => sum + Number(t.quantity || 0), 0);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      label: format(new Date(today.getFullYear(), i, 1), "MMM", { locale: ptBR }),
      revenue: 0,
      qty: 0,
    }));
    (yearTransactions || []).forEach(t => {
      const m = new Date(t.date).getMonth();
      months[m].revenue += Number(t.amount || 0);
      months[m].qty += Number(t.quantity || 0);
    });
    return months;
  }, [yearTransactions]);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const periodLabel = period === "hoje" ? "Hoje" : period === "semana" ? "Semana" : "Mês";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Período</label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Semana</SelectItem>
              <SelectItem value="mes">Mês</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSuperAdmin && calendarLabels && calendarLabels.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Podólogo</label>
            <Select value={selectedPodologo} onValueChange={setSelectedPodologo}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {calendarLabels.map(l => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {procedures && procedures.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Procedimento</label>
            <Select value={selectedProcedure} onValueChange={setSelectedProcedure}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {procedures.map(p => (
                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Categoria</label>
          <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="atendimento">Procedimento</SelectItem>
              <SelectItem value="produto">Produto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agendamentos ({periodLabel})</CardTitle>
            <Calendar className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{appointmentsCount ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento ({periodLabel})</CardTitle>
            <DollarSign className="w-5 h-5 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalQty} item(s)</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Novos Clientes ({periodLabel})</CardTitle>
            <UserPlus className="w-5 h-5 text-accent-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{newClientsCount ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Espera</CardTitle>
            <Clock className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{waitingCount ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Últimos 7 dias</CardTitle>
            <Activity className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(last7Revenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{last7Qty} item(s)</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acumulado {today.getFullYear()}</CardTitle>
            <BarChart3 className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(monthlyData.reduce((s, m) => s + m.revenue, 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyData.reduce((s, m) => s + m.qty, 0)} item(s) no ano
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Acumulado Mensal — {today.getFullYear()}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {monthlyData.map((m) => (
              <div key={m.month} className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground uppercase">{m.label}</p>
                <p className="text-sm font-bold text-foreground mt-1">
                  {m.revenue > 0 ? formatCurrency(m.revenue) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{m.qty} itens</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default DashboardHome;
