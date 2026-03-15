import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleCalendar, CalendarEventExtendedProps } from "@/hooks/useGoogleCalendar";
import { useGoogleOAuth } from "@/hooks/useGoogleOAuth";
import { useClients } from "@/hooks/useClients";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, Globe, Pencil, Trash2, Search, UserPlus, User, Phone, DollarSign, RefreshCw, Mail, Eye, XCircle, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, parseISO } from "date-fns";
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
  accountColor?: string;
  appointment?: Appointment;
  startDateTime?: string;
  endDateTime?: string;
  extendedProperties?: CalendarEventExtendedProps | null;
}

const AgendaModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { events: googleEvents, loading: googleLoading, fetchEvents: fetchGoogleEvents, createEvent: createGoogleEvent, updateEvent: updateGoogleEvent, deleteEvent: deleteGoogleEvent } = useGoogleCalendar();
  const { accounts, isConnected } = useGoogleOAuth();
  const { data: externalClients = [] } = useClients();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("all");

  // Edit/Delete state for Google events
  const [editingEvent, setEditingEvent] = useState<MergedEvent | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<MergedEvent | null>(null);
  const [editEnabled, setEditEnabled] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", description: "", date: "", startTime: "", endTime: "",
    clientName: "", clientWhatsapp: "", clientEmail: "", clientOrigin: "",
    procedureName: "", procedureValue: "", procedure_id: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    title: "", description: "", client_id: "", procedure_id: "",
    date: format(new Date(), "yyyy-MM-dd"), start_time: "09:00",
    duration_minutes: "30", estimated_price: "", notes: "",
    clientName: "", clientWhatsapp: "", clientEmail: "", clientOrigin: "",
  });
  const [isNewClient, setIsNewClient] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const activeAccounts = accounts.filter(a => a.is_active && !a.ical_url);
  const useGoogleAsPrimary = isConnected && activeAccounts.length > 0;

  useEffect(() => {
    if (isConnected) fetchGoogleEvents();
  }, [isConnected]);

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
          accountColor: e.account_color,
          startDateTime: e.startDateTime,
          endDateTime: e.endDateTime,
          extendedProperties: e.extendedProperties,
        }));
    }

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

  // Auto-compose title for create form
  const composedTitle = useMemo(() => {
    if (!useGoogleAsPrimary) return form.title;
    const proc = procedures.find(p => p.id === form.procedure_id);
    const procName = proc?.name || '';
    const name = form.clientName || '';
    if (procName && name) return `${procName} - ${name}`;
    if (procName) return procName;
    if (name) return name;
    return '';
  }, [form.procedure_id, form.clientName, procedures, useGoogleAsPrimary]);

  // Auto-compose title for edit form
  const composedEditTitle = useMemo(() => {
    const procName = editForm.procedureName || '';
    const name = editForm.clientName || '';
    if (procName && name) return `${procName} - ${name}`;
    if (procName) return procName;
    if (name) return name;
    return editForm.title;
  }, [editForm.procedureName, editForm.clientName, editForm.title]);

  const handleSelectExternalClient = (client: typeof externalClients[0]) => {
    const displayName = client.nome || client.nome_wpp || client.whatsapp || '';
    setForm({
      ...form,
      clientName: displayName,
      clientWhatsapp: client.whatsapp || '',
      clientEmail: client.email || '',
      clientOrigin: 'cadastro',
    });
    setIsNewClient(false);
    setClientSearchOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Block scheduling in the past (GMT-3)
    const eventDateTimeStr = `${form.date}T${form.start_time}:00-03:00`;
    const eventDateTime = new Date(eventDateTimeStr);
    if (eventDateTime < new Date()) {
      toast.error("Não é possível agendar no passado");
      return;
    }

    if (useGoogleAsPrimary) {
      const accountId = selectedAccountId || activeAccounts[0]?.id;
      if (!accountId) { toast.error("Selecione uma agenda"); return; }

      const proc = procedures.find(p => p.id === form.procedure_id);
      const durationMs = (proc?.duration_minutes || parseInt(form.duration_minutes) || 30) * 60000;
      const startDT = `${form.date}T${form.start_time}:00`;
      const endDT = new Date(new Date(startDT).getTime() + durationMs).toISOString();

      const title = composedTitle || 'Agendamento';

      const extendedProperties: CalendarEventExtendedProps = {
        clientName: form.clientName,
        clientWhatsapp: form.clientWhatsapp,
        clientEmail: form.clientEmail,
        clientOrigin: form.clientOrigin,
        procedureName: proc?.name || '',
        procedureValue: form.estimated_price || (proc ? String(proc.price) : ''),
      };

      const success = await createGoogleEvent({
        title,
        description: form.description || form.notes || '',
        startDateTime: startDT,
        endDateTime: endDT,
        account_id: accountId,
        extendedProperties,
      });

      if (success) {
        setIsCreateOpen(false);
        resetForm();
      }
    } else {
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
      clientName: "", clientWhatsapp: "", clientEmail: "", clientOrigin: "",
    });
    setIsNewClient(false);
  };

  const handleProcedureSelect = (procId: string) => {
    const proc = procedures.find((p) => p.id === procId);
    setForm({
      ...form,
      procedure_id: procId,
      duration_minutes: proc ? String(proc.duration_minutes) : form.duration_minutes,
      estimated_price: proc ? String(proc.price) : form.estimated_price,
    });
  };

  // Determine if event is in the past
  const isEventPast = (evt: MergedEvent) => {
    if (!evt.startDateTime) return false;
    return new Date(evt.startDateTime) < new Date();
  };

  const handleEditEvent = (evt: MergedEvent) => {
    if (evt.type !== 'google') return;
    setEditingEvent(evt);
    const ep = evt.extendedProperties || {};
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
      clientName: ep.clientName || '',
      clientWhatsapp: ep.clientWhatsapp || '',
      clientEmail: ep.clientEmail || '',
      clientOrigin: ep.clientOrigin || '',
      procedureName: ep.procedureName || '',
      procedureValue: ep.procedureValue || '',
      procedure_id: procedures.find(p => p.name === ep.procedureName)?.id || '',
    });
    setEditEnabled(false);
    setIsEditOpen(true);
  };

  const handleEditProcedureSelect = (procId: string) => {
    const proc = procedures.find(p => p.id === procId);
    if (proc) {
      setEditForm({
        ...editForm,
        procedure_id: procId,
        procedureName: proc.name,
        procedureValue: String(proc.price),
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;
    setEditLoading(true);

    const startDT = new Date(`${editForm.date}T${editForm.startTime}:00`);
    const endDT = new Date(`${editForm.date}T${editForm.endTime}:00`);

    const title = composedEditTitle || editForm.title || 'Agendamento';

    const extendedProperties: CalendarEventExtendedProps = {
      clientName: editForm.clientName,
      clientWhatsapp: editForm.clientWhatsapp,
      clientEmail: editForm.clientEmail,
      clientOrigin: editForm.clientOrigin,
      procedureName: editForm.procedureName,
      procedureValue: editForm.procedureValue,
    };

    const success = await updateGoogleEvent({
      eventId: editingEvent.id,
      title,
      description: editForm.description,
      startDateTime: startDT.toISOString(),
      endDateTime: endDT.toISOString(),
      account_id: editingEvent.accountId,
      extendedProperties,
    });

    setEditLoading(false);
    if (success) {
      setIsEditOpen(false);
      setEditingEvent(null);
    }
  };

  const handleUpdateContact = async () => {
    if (!editForm.clientWhatsapp || !editForm.clientName) {
      toast.error("Nome e WhatsApp são obrigatórios para atualizar contato");
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { error } = await supabase.functions.invoke('update-whatsapp-contact', {
        body: {
          name: editForm.clientName,
          whatsapp: editForm.clientWhatsapp,
          origin: editForm.clientOrigin,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      toast.success("Contato atualizado!");
    } catch (err) {
      toast.error("Erro ao atualizar contato");
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

  const navigate = (dir: number) => {
    setSelectedDate((d) => {
      if (view === "month") return dir > 0 ? addMonths(d, 1) : subMonths(d, 1);
      return addDays(d, view === "day" ? dir : dir * 7);
    });
  };

  const handleSlotClick = (date: Date, time: string) => {
    // Block past slots (GMT-3)
    const slotStr = `${format(date, "yyyy-MM-dd")}T${time}:00-03:00`;
    const slotDateTime = new Date(slotStr);
    if (slotDateTime < new Date()) {
      toast.error("Não é possível agendar no passado");
      return;
    }
    setForm({ ...form, date: format(date, "yyyy-MM-dd"), start_time: time });
    setIsCreateOpen(true);
  };

  const handleDaySlotClick = (time: string) => {
    handleSlotClick(selectedDate, time);
  };

  const handleMonthDayClick = (day: Date) => {
    setSelectedDate(day);
    setView("day");
  };

  const dayEvents = (day: Date) =>
    mergedEvents.filter((e) => isSameDay(parseISO(e.date), day));

  // Filtered external clients for search
  const filteredExternalClients = useMemo(() => {
    if (!clientSearch) return externalClients.slice(0, 20);
    const q = clientSearch.toLowerCase();
    return externalClients.filter(c => {
      const name = c.nome || c.nome_wpp || '';
      return name.toLowerCase().includes(q) || c.whatsapp?.includes(q);
    }).slice(0, 20);
  }, [externalClients, clientSearch]);

  const renderEventCard = (evt: MergedEvent) => {
    if (evt.type === 'google') {
      const ep = evt.extendedProperties;
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
                {ep?.procedureValue && (
                  <p className="text-xs text-green-700 font-medium">R$ {Number(ep.procedureValue).toFixed(2)}</p>
                )}
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

  // Google Calendar create form
  const renderGoogleCreateForm = () => (
    <>
      {/* Procedimento */}
      <div className="space-y-2">
        <Label>Procedimento</Label>
        <Select value={form.procedure_id} onValueChange={handleProcedureSelect}>
          <SelectTrigger><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
          <SelectContent>
            {procedures.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — R$ {Number(p.price).toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cliente */}
      <div className="space-y-2">
        <Label className="flex items-center justify-between">
          <span>Cliente</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => { setIsNewClient(!isNewClient); if (!isNewClient) setForm({ ...form, clientName: '', clientWhatsapp: '', clientEmail: '', clientOrigin: '' }); }}
          >
            <UserPlus className="w-3 h-3" />
            {isNewClient ? 'Buscar existente' : 'Novo cliente'}
          </Button>
        </Label>

        {isNewClient ? (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Nome *</Label>
              <Input
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</Label>
              <Input
                value={form.clientWhatsapp}
                onChange={(e) => setForm({ ...form, clientWhatsapp: e.target.value })}
                placeholder="5511999999999"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
              <Input
                value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                placeholder="email@exemplo.com"
                type="email"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Origem do Contato</Label>
              <Select value={form.clientOrigin} onValueChange={(v) => setForm({ ...form, clientOrigin: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <Search className="w-4 h-4 mr-2 text-muted-foreground" />
                {form.clientName || "Buscar cliente..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Buscar por nome ou WhatsApp..."
                  value={clientSearch}
                  onValueChange={setClientSearch}
                />
                <CommandList>
                  <CommandEmpty>Nenhum cliente encontrado</CommandEmpty>
                  <CommandGroup>
                    {filteredExternalClients.map((c, i) => (
                      <CommandItem
                        key={`${c.whatsapp}-${i}`}
                        onSelect={() => handleSelectExternalClient(c)}
                        className="flex flex-col items-start"
                      >
                        <span className="font-medium">{c.nome || c.nome_wpp || c.whatsapp}</span>
                        <span className="text-xs text-muted-foreground">{c.whatsapp}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Show selected client details (editable) */}
        {!isNewClient && form.clientName && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Nome</Label>
              <Input
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</Label>
              <Input
                value={form.clientWhatsapp}
                onChange={(e) => setForm({ ...form, clientWhatsapp: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
              <Input
                value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                className="h-8 text-sm"
                type="email"
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Origem</Label>
              <Select value={form.clientOrigin} onValueChange={(v) => setForm({ ...form, clientOrigin: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="cadastro">Cadastro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Título (auto-composto) */}
      <div className="space-y-2">
        <Label>Título (auto)</Label>
        <Input value={composedTitle} readOnly className="bg-muted/50" />
      </div>

      {/* Valor */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Valor (R$)</Label>
        <Input
          type="number"
          step="0.01"
          value={form.estimated_price}
          onChange={(e) => setForm({ ...form, estimated_price: e.target.value })}
          placeholder="0.00"
        />
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Informações importantes sobre o atendimento"
          rows={2}
        />
      </div>

      {/* Data/Hora */}
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
            <SelectTrigger><SelectValue placeholder="Selecione a agenda" /></SelectTrigger>
            <SelectContent>
              {activeAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>{acc.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );

  // Local create form
  const renderLocalCreateForm = () => (
    <>
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
                : view === "week"
                ? `${format(weekStart, "dd/MM")} — ${format(weekEnd, "dd/MM/yyyy")}`
                : format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
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
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary gap-2 shadow-card">
                <Plus className="w-4 h-4" /> Agendar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {useGoogleAsPrimary ? "Novo Evento no Google Calendar" : "Novo Agendamento"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                {useGoogleAsPrimary ? renderGoogleCreateForm() : renderLocalCreateForm()}

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button
                    type="submit"
                    className="bg-gradient-primary"
                    disabled={useGoogleAsPrimary ? !composedTitle : !form.client_id}
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
        <TimeGrid
          events={dayEvents(selectedDate)}
          onSlotClick={handleDaySlotClick}
          onEventClick={(evt) => evt.type === 'google' ? handleEditEvent(evt) : undefined}
          onStatusChange={!useGoogleAsPrimary ? (id, status) => updateStatusMutation.mutate({ id, status }) : undefined}
        />
      ) : view === "week" ? (
        <WeekTimeGrid
          days={weekDays}
          getEventsForDay={dayEvents}
          onSlotClick={handleSlotClick}
          onEventClick={(evt) => evt.type === 'google' ? handleEditEvent(evt) : undefined}
          isToday={isToday}
        />
      ) : (
        <MonthView
          currentMonth={selectedDate}
          events={mergedEvents}
          onDayClick={handleMonthDayClick}
        />
      )}

      {/* Edit Google Event Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          {(() => {
            const isPast = editingEvent ? isEventPast(editingEvent) : false;
            const isDisabled = isPast || !editEnabled;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {isPast ? <Eye className="w-5 h-5" /> : isDisabled ? <Lock className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
                      {isPast ? 'Visualizar Evento' : isDisabled ? 'Detalhes do Evento' : 'Editar Evento'}
                    </span>
                    <div className="flex gap-1">
                      {!isPast && !editEnabled && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditEnabled(true)}
                          className="gap-1 text-xs"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Habilitar Edição
                        </Button>
                      )}
                      {!isPast && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEventToDelete(editingEvent);
                            setShowCancelDialog(true);
                          }}
                          className="gap-1 text-destructive hover:text-destructive text-xs"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancelar Evento
                        </Button>
                      )}
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {isPast && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                      Evento passado — somente leitura. Você pode adicionar observações abaixo.
                    </div>
                  )}

                  {/* Procedimento */}
                  <div className="space-y-2">
                    <Label>Procedimento</Label>
                    <Select value={editForm.procedure_id} onValueChange={handleEditProcedureSelect} disabled={isPast}>
                      <SelectTrigger><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
                      <SelectContent>
                        {procedures.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — R$ {Number(p.price).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Client fields */}
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Dados do Cliente</p>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Nome</Label>
                      <Input
                        value={editForm.clientName}
                        onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Nome do cliente"
                        disabled={isPast}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</Label>
                      <Input
                        value={editForm.clientWhatsapp}
                        onChange={(e) => setEditForm({ ...editForm, clientWhatsapp: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="5511999999999"
                        disabled={isPast}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                      <Input
                        value={editForm.clientEmail}
                        onChange={(e) => setEditForm({ ...editForm, clientEmail: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="email@exemplo.com"
                        type="email"
                        disabled={isPast}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Origem</Label>
                      <Select value={editForm.clientOrigin} onValueChange={(v) => setEditForm({ ...editForm, clientOrigin: v })} disabled={isPast}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="indicacao">Indicação</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="google">Google</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="cadastro">Cadastro</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Título (auto) */}
                  <div className="space-y-2">
                    <Label>Título (auto)</Label>
                    <Input value={composedEditTitle} readOnly className="bg-muted/50" />
                  </div>

                  {/* Valor */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.procedureValue}
                      onChange={(e) => setEditForm({ ...editForm, procedureValue: e.target.value })}
                      placeholder="0.00"
                      disabled={isPast}
                    />
                  </div>

                  {/* Observações — always editable, but for past events only append */}
                  <div className="space-y-2">
                    <Label>Observações {isPast && <span className="text-xs text-muted-foreground">(adicionar novas)</span>}</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => {
                        if (isPast) {
                          // For past events, only allow appending (can't remove existing content)
                          const original = editingEvent?.description || '';
                          if (e.target.value.startsWith(original)) {
                            setEditForm({ ...editForm, description: e.target.value });
                          }
                        } else {
                          setEditForm({ ...editForm, description: e.target.value });
                        }
                      }}
                      rows={3}
                    />
                  </div>

                  {/* Date/Time */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} disabled={isPast} />
                    </div>
                    <div className="space-y-2">
                      <Label>Início</Label>
                      <Input type="time" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} disabled={isPast} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim</Label>
                      <Input type="time" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} disabled={isPast} />
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  {!isPast && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUpdateContact}
                      disabled={editLoading}
                      className="gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Atualizar Contato
                    </Button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={editLoading}>
                      {isPast ? 'Fechar' : 'Cancelar'}
                    </Button>
                    {isPast ? (
                      editForm.description !== (editingEvent?.description || '') && (
                        <Button onClick={handleSaveEdit} disabled={editLoading}>
                          {editLoading ? "Salvando..." : "Salvar Observações"}
                        </Button>
                      )
                    ) : (
                      <Button onClick={handleSaveEdit} disabled={editLoading || !composedEditTitle}>
                        {editLoading ? "Salvando..." : "Salvar Evento"}
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </>
            );
          })()}
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
