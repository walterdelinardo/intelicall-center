import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors: Record<string, string> = {
  agendado: "bg-primary/10 text-primary border-primary/30",
  confirmado: "bg-blue-100 text-blue-700 border-blue-300",
  compareceu: "bg-green-100 text-green-700 border-green-300",
  faltou: "bg-red-100 text-red-700 border-red-300",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  compareceu: "Compareceu",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

interface Appointment {
  id: string;
  client_id: string;
  procedure_id: string | null;
  professional_id: string | null;
  date: string;
  start_time: string;
  duration_minutes: number;
  estimated_price: number | null;
  status: string;
  notes: string | null;
  clients?: { name: string } | null;
  procedures?: { name: string; price: number } | null;
}

const AgendaModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week">("day");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    client_id: "", procedure_id: "", date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00", duration_minutes: "30", estimated_price: "", notes: "",
  });

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetch date range for current view
  const dateFrom = view === "day" ? format(selectedDate, "yyyy-MM-dd") : format(weekStart, "yyyy-MM-dd");
  const dateTo = view === "day" ? format(selectedDate, "yyyy-MM-dd") : format(weekEnd, "yyyy-MM-dd");

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", profile?.clinic_id, dateFrom, dateTo],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*, clients(name), procedures(name, price)")
        .eq("clinic_id", profile.clinic_id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date")
        .order("start_time");
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("clients").select("id, name")
        .eq("clinic_id", profile.clinic_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ["procedures-list", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("procedures").select("id, name, duration_minutes, price")
        .eq("clinic_id", profile.clinic_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      const { error } = await supabase.from("appointments").insert({
        clinic_id: profile.clinic_id,
        client_id: form.client_id,
        procedure_id: form.procedure_id || null,
        date: form.date,
        start_time: form.start_time,
        duration_minutes: parseInt(form.duration_minutes) || 30,
        estimated_price: form.estimated_price ? parseFloat(form.estimated_price) : null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento criado!");
      setIsCreateOpen(false);
      setForm({ client_id: "", procedure_id: "", date: format(selectedDate, "yyyy-MM-dd"), start_time: "09:00", duration_minutes: "30", estimated_price: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Status atualizado!");
    },
  });

  const handleProcedureSelect = (procId: string) => {
    const proc = procedures.find((p) => p.id === procId);
    setForm({
      ...form,
      procedure_id: procId,
      duration_minutes: proc ? String(proc.duration_minutes) : form.duration_minutes,
      estimated_price: proc ? String(proc.price) : form.estimated_price,
    });
  };

  const navigate = (dir: number) => {
    setSelectedDate((d) => addDays(d, view === "day" ? dir : dir * 7));
  };

  const dayAppointments = (day: Date) =>
    appointments.filter((a) => isSameDay(parseISO(a.date), day));

  const renderAppointmentCard = (apt: Appointment) => (
    <Card key={apt.id} className={`border shadow-sm ${statusColors[apt.status] || ""}`}>
      <CardContent className="p-3 space-y-1">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium text-sm">{(apt.clients as any)?.name || "Cliente"}</p>
            <p className="text-xs opacity-75">{(apt.procedures as any)?.name || "Procedimento"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" /> {apt.start_time?.slice(0, 5)}
            </p>
            <p className="text-xs opacity-75">{apt.duration_minutes}min</p>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap pt-1">
          {Object.keys(statusLabels).map((s) => (
            <button
              key={s}
              onClick={() => updateStatusMutation.mutate({ id: apt.id, status: s })}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                apt.status === s ? statusColors[s] + " font-semibold" : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <h2 className="font-semibold">
              {view === "day"
                ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
                : `${format(weekStart, "dd/MM")} — ${format(weekEnd, "dd/MM/yyyy")}`}
            </h2>
          </div>
          <Button size="icon" variant="outline" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>Hoje</Button>
        </div>

        <div className="flex gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary gap-2 shadow-card">
                <Plus className="w-4 h-4" /> Agendar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Procedimento</Label>
                  <Select value={form.procedure_id} onValueChange={handleProcedureSelect}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {procedures.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário *</Label>
                    <Input type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duração (min)</Label>
                    <Input type="number" min="5" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={form.estimated_price} onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-gradient-primary" disabled={createMutation.isPending || !form.client_id}>
                    {createMutation.isPending ? "Salvando..." : "Agendar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar views */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : view === "day" ? (
        <div className="space-y-3">
          {dayAppointments(selectedDate).length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum agendamento para este dia.
              </CardContent>
            </Card>
          ) : (
            dayAppointments(selectedDate).map(renderAppointmentCard)
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="space-y-2">
              <div className={`text-center text-sm font-medium p-2 rounded-lg ${isToday(day) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="text-xs opacity-75">{format(day, "EEE", { locale: ptBR })}</div>
                <div>{format(day, "dd")}</div>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {dayAppointments(day).map((apt) => (
                  <Card key={apt.id} className={`border text-xs ${statusColors[apt.status]}`}>
                    <CardContent className="p-2">
                      <p className="font-medium truncate">{(apt.clients as any)?.name}</p>
                      <p className="opacity-75">{apt.start_time?.slice(0, 5)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgendaModule;
