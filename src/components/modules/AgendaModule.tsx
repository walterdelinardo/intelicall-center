import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useGoogleOAuth } from "@/hooks/useGoogleOAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, Globe, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TimeGrid, WeekTimeGrid } from "./agenda/TimeGrid";
import { MonthView } from "./agenda/MonthView";

const statusColors: Record<string, string> = {
  agendado: "bg-primary/10 text-primary border-primary/30",
  confirmado: "bg-blue-100 text-blue-700 border-blue-300",
  compareceu: "bg-green-100 text-green-700 border-green-300",
  faltou: "bg-red-100 text-red-700 border-red-300",
  cancelado: "bg-muted text-muted-foreground border-border",
  confirmed: "bg-blue-100 text-blue-700 border-blue-300",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
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

interface MergedEvent {
  type: 'local' | 'google';
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  status: string;
  description?: string;
  accountLabel?: string;
  accountId?: string;
  appointment?: Appointment;
  startDateTime?: string;
  endDateTime?: string;
}

const AgendaModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { events: googleEvents, loading: googleLoading, fetchEvents: fetchGoogleEvents, createEvent: createGoogleEvent, updateEvent: updateGoogleEvent, deleteEvent: deleteGoogleEvent } = useGoogleCalendar();
  const { accounts, isConnected } = useGoogleOAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("all");

  // Edit/Delete state for Google events
  const [editingEvent, setEditingEvent] = useState<MergedEvent | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<MergedEvent | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", date: "", startTime: "", endTime: "" });
  const [editLoading, setEditLoading] = useState(false);

  // Create form - adapts based on whether Google is primary
  const [form, setForm] = useState({
    title: "", description: "", client_id: "", procedure_id: "",
    date: format(new Date(), "yyyy-MM-dd"), start_time: "09:00",
    duration_minutes: "30", estimated_price: "", notes: "",
  });

  const activeAccounts = accounts.filter(a => a.is_active && !a.ical_url);
  const useGoogleAsPrimary = isConnected && activeAccounts.length > 0;

  useEffect(() => {
    if (isConnected) fetchGoogleEvents();
  }, [isConnected]);

  // Set default account
  useEffect(() => {
    if (activeAccounts.length === 1 && !selectedAccountId) {
      setSelectedAccountId(activeAccounts[0].id);
    }
  }, [activeAccounts, selectedAccountId]);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const dateFrom = view === "day" ? format(selectedDate, "yyyy-MM-dd") : format(weekStart, "yyyy-MM-dd");
  const dateTo = view === "day" ? format(selectedDate, "yyyy-MM-dd") : format(weekEnd, "yyyy-MM-dd");

  // Only fetch local appointments if Google is NOT primary
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
    enabled: !!profile?.clinic_id && !useGoogleAsPrimary,
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

  const mergedEvents = useMemo((): MergedEvent[] => {
    if (useGoogleAsPrimary) {
      // Google is primary — show only Google events
      return googleEvents
        .filter((e) => filterAccount === 'all' || e.account_id === filterAccount)
        .map((e) => ({
          type: 'google' as const,
          id: e.id,
          title: e.title,
          date: e.date,
          time: e.time,
          duration: e.duration,
          status: e.status,
          description: e.description,
          accountLabel: e.account_label,
          accountId: e.account_id,
          startDateTime: e.startDateTime,
          endDateTime: e.endDateTime,
        }));
    }

    // No Google — show local appointments
    return appointments.map((apt) => ({
      type: 'local' as const,
      id: apt.id,
      title: (apt.clients as any)?.name || 'Cliente',
      date: apt.date,
      time: apt.start_time?.slice(0, 5) || '',
      duration: `${apt.duration_minutes}min`,
      status: apt.status,
      appointment: apt,
    }));
  }, [appointments, googleEvents, filterAccount, useGoogleAsPrimary]);

  // Create event — Google-first when connected
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (useGoogleAsPrimary) {
      // Create directly in Google Calendar
      const accountId = selectedAccountId || activeAccounts[0]?.id;
      if (!accountId) { toast.error("Selecione uma agenda"); return; }

      const durationMs = (parseInt(form.duration_minutes) || 30) * 60000;
      const startDT = `${form.date}T${form.start_time}:00`;
      const endDT = new Date(new Date(startDT).getTime() + durationMs).toISOString();

      const title = form.title || (() => {
        const clientName = clients.find(c => c.id === form.client_id)?.name;
        const procName = procedures.find(p => p.id === form.procedure_id)?.name;
        return `${clientName || 'Agendamento'}${procName ? ` — ${procName}` : ''}`;
      })();

      const success = await createGoogleEvent({
        title,
        description: form.description || form.notes || '',
        startDateTime: startDT,
        endDateTime: endDT,
        account_id: accountId,
      });

      if (success) {
        setIsCreateOpen(false);
        resetForm();
      }
    } else {
      // Create locally
      if (!profile?.clinic_id || !form.client_id) return;
      try {
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
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        toast.success("Agendamento criado!");
        setIsCreateOpen(false);
        resetForm();
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  const resetForm = () => {
    setForm({
      title: "", description: "", client_id: "", procedure_id: "",
      date: format(selectedDate, "yyyy-MM-dd"), start_time: "09:00",
      duration_minutes: "30", estimated_price: "", notes: "",
    });
  };

  // Edit Google event
  const handleEditEvent = (evt: MergedEvent) => {
    if (evt.type !== 'google') return;
    setEditingEvent(evt);
    setEditForm({
      title: evt.title,
      description: evt.description || '',
      date: evt.date,
      startTime: evt.time,
      endTime: (() => {
        const durationMatch = evt.duration.match(/(\d+)/);
        const durationMin = durationMatch ? parseInt(durationMatch[1]) : 60;
        const [h, m] = evt.time.split(':').map(Number);
        const totalMin = h * 60 + m + durationMin;
        return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
      })(),
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;
    setEditLoading(true);

    const startDT = new Date(`${editForm.date}T${editForm.startTime}:00`);
    const endDT = new Date(`${editForm.date}T${editForm.endTime}:00`);

    const success = await updateGoogleEvent({
      eventId: editingEvent.id,
      title: editForm.title,
      description: editForm.description,
      startDateTime: startDT.toISOString(),
      endDateTime: endDT.toISOString(),
      account_id: editingEvent.accountId,
    });

    setEditLoading(false);
    if (success) {
      setIsEditOpen(false);
      setEditingEvent(null);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    setEditLoading(true);
    const success = await deleteGoogleEvent(eventToDelete.id, eventToDelete.accountId);
    setEditLoading(false);
    if (success) {
      setShowDeleteDialog(false);
      setEventToDelete(null);
    }
  };

  // Local appointment status update
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

  const dayEvents = (day: Date) =>
    mergedEvents.filter((e) => isSameDay(parseISO(e.date), day));

  const renderEventCard = (evt: MergedEvent) => {
    if (evt.type === 'google') {
      return (
        <Card
          key={`g-${evt.id}`}
          className="border border-blue-200 bg-blue-50/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleEditEvent(evt)}
        >
          <CardContent className="p-3 space-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm text-blue-900">{evt.title}</p>
                {evt.description && (
                  <p className="text-xs text-blue-600/70 line-clamp-1">{evt.description}</p>
                )}
                {evt.accountLabel && (
                  <Badge variant="outline" className="text-[10px] mt-0.5 border-blue-300 text-blue-600">
                    <Globe className="w-3 h-3 mr-1" />
                    {evt.accountLabel}
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs font-medium flex items-center gap-1 text-blue-700">
                  <Clock className="w-3 h-3" /> {evt.time}
                </p>
                <p className="text-xs text-blue-500">{evt.duration}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    const apt = evt.appointment!;
    return (
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
  };

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

        <div className="flex gap-2 flex-wrap items-center">
          {isConnected && activeAccounts.length > 0 && (
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Filtrar agenda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as agendas</SelectItem>
                {activeAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
                <DialogTitle>
                  {useGoogleAsPrimary ? "Novo Evento no Google Calendar" : "Novo Agendamento"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                {useGoogleAsPrimary ? (
                  <>
                    {/* Google Calendar form */}
                    <div className="space-y-2">
                      <Label>Título *</Label>
                      <Input
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Ex: Consulta João Silva"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Detalhes do evento"
                        rows={2}
                      />
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
                    <div className="space-y-2">
                      <Label>Duração (min)</Label>
                      <Input type="number" min="5" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                    </div>
                    {activeAccounts.length > 1 && (
                      <div className="space-y-2">
                        <Label>Agenda</Label>
                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a agenda" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>{acc.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Local appointments form */}
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
                  </>
                )}

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button
                    type="submit"
                    className="bg-gradient-primary"
                    disabled={useGoogleAsPrimary ? !form.title : !form.client_id}
                  >
                    {useGoogleAsPrimary ? "Criar Evento" : "Agendar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Google connected indicator */}
      {useGoogleAsPrimary && (
        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
          <Globe className="w-4 h-4" />
          <span>Google Calendar é a fonte principal. Alterações sincronizam automaticamente.</span>
        </div>
      )}

      {/* Calendar views */}
      {(isLoading || googleLoading) ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : view === "day" ? (
        <div className="space-y-3">
          {dayEvents(selectedDate).length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum agendamento para este dia.
              </CardContent>
            </Card>
          ) : (
            dayEvents(selectedDate).map(renderEventCard)
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
                {dayEvents(day).map((evt) => (
                  <Card
                    key={`${evt.type}-${evt.id}`}
                    className={`border text-xs cursor-pointer hover:shadow-md transition-shadow ${evt.type === 'google' ? 'border-blue-200 bg-blue-50/50' : statusColors[evt.status]}`}
                    onClick={() => evt.type === 'google' && handleEditEvent(evt)}
                  >
                    <CardContent className="p-2">
                      <p className="font-medium truncate">{evt.title}</p>
                      <p className="opacity-75">{evt.time}</p>
                      {evt.type === 'google' && evt.accountLabel && (
                        <p className="text-[10px] text-blue-500 truncate">{evt.accountLabel}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Google Event Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                Editar Evento
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEventToDelete(editingEvent);
                  setShowDeleteDialog(true);
                }}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={editLoading}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={editLoading || !editForm.title}>
              {editLoading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{eventToDelete?.title}"? O evento será removido do Google Calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={editLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {editLoading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AgendaModule;
