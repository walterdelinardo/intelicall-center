import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleCalendar, CalendarEventExtendedProps } from "@/hooks/useGoogleCalendar";
import { useGoogleOAuth } from "@/hooks/useGoogleOAuth";
import { useClients } from "@/hooks/useClients";
import { useDashboard } from "@/contexts/DashboardContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, Globe, Pencil, Trash2, Search, UserPlus, User, Phone, DollarSign, RefreshCw, Mail, Eye, XCircle, Lock, Unlock, CalendarDays, Receipt, X, ShoppingCart, Stethoscope, MessageSquare, Bell } from "lucide-react";
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

const paymentMethods: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito", transferencia: "Transferência", boleto: "Boleto",
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
  google_event_id: string | null;
  parent_appointment_id: string | null;
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
  const { openProntuario } = useDashboard();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { events: googleEvents, loading: googleLoading, fetchEvents: fetchGoogleEvents, createEvent: createGoogleEvent, updateEvent: updateGoogleEvent, deleteEvent: deleteGoogleEvent } = useGoogleCalendar();
  const { accounts, isConnected } = useGoogleOAuth();
  const { data: externalClients = [] } = useClients();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [agendaTab, setAgendaTab] = useState<"calendario" | "notificacoes">("calendario");

  // Edit/Delete state for Google events
  const [editingEvent, setEditingEvent] = useState<MergedEvent | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [eventToDelete, setEventToDelete] = useState<MergedEvent | null>(null);
  const [editEnabled, setEditEnabled] = useState(false);
  const [waitingSuggestions, setWaitingSuggestions] = useState<any[]>([]);
  const [showWaitingSuggestions, setShowWaitingSuggestions] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", description: "", date: "", startTime: "", endTime: "",
    clientName: "", clientWhatsapp: "", clientEmail: "", clientOrigin: "",
    procedureName: "", procedureValue: "", procedure_id: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  // Billing state
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [billingEvent, setBillingEvent] = useState<MergedEvent | null>(null);

  // Create form state
  const [form, setForm] = useState({
    title: "", description: "", client_id: "", procedure_id: "",
    date: format(new Date(), "yyyy-MM-dd"), start_time: "09:00",
    duration_minutes: "30", estimated_price: "", notes: "",
    clientName: "", clientWhatsapp: "", clientEmail: "", clientOrigin: "",
    clientBirthdate: "",
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
        .from("clients").select("id, name, email, whatsapp, phone, birth_date")
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

  // Calendar notifications query
  const { data: notifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ["calendar-notifications", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("calendar_notifications" as any)
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  const logNotification = useCallback(async (action: string, eventTitle: string, accountId?: string, details?: string) => {
    if (!profile?.clinic_id) return;
    try {
      await supabase.from("calendar_notifications" as any).insert({
        clinic_id: profile.clinic_id,
        account_id: accountId || null,
        event_title: eventTitle,
        action,
        details: details || null,
        actor_name: profile.full_name || "Sistema",
      });
      refetchNotifications();
    } catch (err) {
      console.error("Error logging notification:", err);
    }
  }, [profile?.clinic_id, profile?.full_name, refetchNotifications]);

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

    return appointments
      .filter((apt) => !apt.parent_appointment_id)
      .map((apt) => ({
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

  const handleSelectLocalClient = (client: typeof clients[0]) => {
    setForm({
      ...form,
      clientName: client.name,
      clientWhatsapp: client.whatsapp || client.phone || '',
      clientEmail: client.email || '',
      clientOrigin: 'cadastro',
    });
    setIsNewClient(false);
    setClientSearchOpen(false);
  };

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
    if (isSubmitting) return;

    // Block scheduling in the past (GMT-3)
    const eventDateTimeStr = `${form.date}T${form.start_time}:00-03:00`;
    const eventDateTime = new Date(eventDateTimeStr);
    if (eventDateTime < new Date()) {
      toast.error("Não é possível agendar no passado");
      return;
    }

    setIsSubmitting(true);

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
        clientBirthdate: isNewClient ? form.clientBirthdate : undefined,
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

      setIsSubmitting(false);
      if (success) {
        setIsCreateOpen(false);
        resetForm();
        logNotification("created", title, accountId, `Novo evento criado: ${title}`);

        // Auto-create prontuário and redirect
        if (profile?.clinic_id && form.clientName) {
          try {
            // Resolve or create local client
            let clientId: string | null = null;
            if (form.clientWhatsapp) {
              const { data: existing } = await supabase
                .from("clients").select("id")
                .eq("clinic_id", profile.clinic_id)
                .eq("whatsapp", form.clientWhatsapp)
                .maybeSingle();
              if (existing) clientId = existing.id;
            }
            if (!clientId) {
              const { data: byName } = await supabase
                .from("clients").select("id")
                .eq("clinic_id", profile.clinic_id)
                .eq("name", form.clientName)
                .maybeSingle();
              if (byName) clientId = byName.id;
            }
            if (!clientId) {
              const { data: newClient } = await supabase
                .from("clients")
                .insert({
                  clinic_id: profile.clinic_id,
                  name: form.clientName,
                  whatsapp: form.clientWhatsapp || null,
                  email: form.clientEmail || null,
                  birth_date: form.clientBirthdate || null,
                  lead_source: form.clientOrigin || null,
                })
                .select("id")
                .single();
              if (newClient) clientId = newClient.id;
            }

            if (clientId) {
              // Create medical_record if not exists for this client (1 per patient)
              const { data: existingRecord } = await supabase
                .from("medical_records")
                .select("id")
                .eq("clinic_id", profile.clinic_id)
                .eq("client_id", clientId)
                .maybeSingle();

              if (!existingRecord) {
                await supabase.from("medical_records").insert({
                  clinic_id: profile.clinic_id,
                  client_id: clientId,
                  date: form.date,
                  chief_complaint: proc?.name || '',
                });
              }

              // Redirect to prontuário
              openProntuario(clientId);
            }
          } catch (err) {
            console.error("Error auto-creating prontuário:", err);
          }
        }
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
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const resetForm = () => {
    setForm({
      title: "", description: "", client_id: "", procedure_id: "",
      date: format(selectedDate, "yyyy-MM-dd"), start_time: "09:00",
      duration_minutes: "30", estimated_price: "", notes: "",
      clientName: "", clientWhatsapp: "", clientEmail: "", clientOrigin: "",
      clientBirthdate: "",
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
      const wasRescheduled = editingEvent && (editForm.date !== editingEvent.date || editForm.startTime !== editingEvent.time);
      logNotification(wasRescheduled ? "rescheduled" : "updated", title, editingEvent?.accountId, wasRescheduled ? `Reagendado para ${editForm.date} ${editForm.startTime}` : `Evento atualizado`);
      setIsEditOpen(false);
      setEditingEvent(null);
    }
  };

  const handleCancelEvent = async () => {
    if (!eventToDelete || !cancelReason.trim()) {
      toast.error("Informe o motivo do cancelamento");
      return;
    }
    setEditLoading(true);
    const success = await deleteGoogleEvent(eventToDelete.id, eventToDelete.accountId);
    if (success && profile?.clinic_id) {
      // Insert financial transaction for cancellation
      try {
        await supabase.from("financial_transactions").insert({
          clinic_id: profile.clinic_id,
          type: "receita",
          category: "atendimento",
          description: eventToDelete.title,
          amount: 0,
          status: "cancelado",
          date: eventToDelete.date,
          notes: `Motivo do cancelamento: ${cancelReason}`,
          payment_method: null,
        });
      } catch (err) {
        console.error("Error inserting cancel transaction:", err);
      }
      queryClient.invalidateQueries({ queryKey: ["financial-daily"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });

      // Check waiting list for compatible patients
      try {
        const { data: waitingItems } = await supabase
          .from("waiting_list")
          .select("*, clients(name, whatsapp, phone), procedures(name), profiles(full_name)")
          .eq("clinic_id", profile.clinic_id)
          .in("status", ["aguardando", "notificado"])
          .order("created_at", { ascending: true });

        if (waitingItems && waitingItems.length > 0) {
          const cancelDate = eventToDelete.date;
          const compatible = waitingItems.filter((w: any) => {
            if (w.desired_date && w.desired_date !== cancelDate) {
              if (w.flexibility === "mesmo_dia") return false;
            }
            return true;
          });

          const priorityOrder: Record<string, number> = { urgencia: 0, alta: 1, normal: 2, baixa: 3 };
          compatible.sort((a: any, b: any) => {
            const pa = priorityOrder[a.priority] ?? 2;
            const pb = priorityOrder[b.priority] ?? 2;
            if (pa !== pb) return pa - pb;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });

          if (compatible.length > 0) {
            setWaitingSuggestions(compatible.slice(0, 10));
            setShowWaitingSuggestions(true);
          }
        }
      } catch (err) {
        console.error("Error checking waiting list:", err);
      }
    }
    setEditLoading(false);
    if (success) {
      logNotification("cancelled", eventToDelete?.title || "", eventToDelete?.accountId, `Cancelado: ${cancelReason}`);
      setShowCancelDialog(false);
      setEventToDelete(null);
      setCancelReason("");
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
      logNotification("cancelled", eventToDelete?.title || "", eventToDelete?.accountId, "Evento excluído");
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
  const filteredSearchClients = useMemo(() => {
    const q = (clientSearch || '').toLowerCase();
    // Local clients first
    const localResults = clients
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.whatsapp?.includes(q) || c.email?.toLowerCase().includes(q))
      .map(c => ({ type: 'local' as const, id: c.id, name: c.name, whatsapp: c.whatsapp || c.phone || '', email: c.email || '' }));
    // External clients (exclude duplicates by whatsapp)
    const localWhatsapps = new Set(localResults.map(c => c.whatsapp).filter(Boolean));
    const extResults = externalClients
      .filter(c => {
        const name = c.nome || c.nome_wpp || '';
        return (!q || name.toLowerCase().includes(q) || c.whatsapp?.includes(q)) && !localWhatsapps.has(c.whatsapp || '');
      })
      .slice(0, 15)
      .map(c => ({ type: 'external' as const, id: '', name: c.nome || c.nome_wpp || c.whatsapp || '', whatsapp: c.whatsapp || '', email: c.email || '' }));
    return [...localResults.slice(0, 15), ...extResults];
  }, [clients, externalClients, clientSearch]);

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
          <span className="inline-flex">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs gap-1"
              onClick={() => { setIsNewClient(!isNewClient); if (!isNewClient) setForm({ ...form, clientName: '', clientWhatsapp: '', clientEmail: '', clientOrigin: '', clientBirthdate: '' }); }}
            >
              {isNewClient ? <><Search className="w-3 h-3" /> Buscar existente</> : <><UserPlus className="w-3 h-3" /> Novo cliente</>}
            </Button>
          </span>
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
              <Label className="text-xs flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Data de Nascimento</Label>
              <Input
                type="date"
                value={form.clientBirthdate}
                onChange={(e) => setForm({ ...form, clientBirthdate: e.target.value })}
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
                  <CommandGroup heading="Clientes">
                    {filteredSearchClients.map((c, i) => (
                      <CommandItem
                        key={`${c.type}-${c.id || c.whatsapp}-${i}`}
                        onSelect={() => {
                          if (c.type === 'local') {
                            const localClient = clients.find(cl => cl.id === c.id);
                            if (localClient) handleSelectLocalClient(localClient);
                          } else {
                            const extClient = externalClients.find(ec => ec.whatsapp === c.whatsapp);
                            if (extClient) handleSelectExternalClient(extClient);
                          }
                        }}
                        className="flex flex-col items-start"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.whatsapp}{c.email ? ` • ${c.email}` : ''}
                          {c.type === 'local' ? ' (cadastrado)' : ''}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Show selected client details (editable) — no origin field for existing clients */}
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

  const notificationActionIcons: Record<string, string> = {
    created: "🆕",
    updated: "✏️",
    rescheduled: "📅",
    cancelled: "❌",
  };

  const notificationActionLabels: Record<string, string> = {
    created: "Novo Agendamento",
    updated: "Atualizado",
    rescheduled: "Reagendado",
    cancelled: "Cancelado",
  };

  return (
    <Tabs value={agendaTab} onValueChange={(v) => setAgendaTab(v as any)} className="space-y-4">
      <TabsList>
        <TabsTrigger value="calendario" className="gap-2">
          <Calendar className="w-4 h-4" /> Calendário
        </TabsTrigger>
        <TabsTrigger value="notificacoes" className="gap-2">
          <Bell className="w-4 h-4" /> Notificações
          {notifications.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-[10px]">{notifications.length}</Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="notificacoes" className="space-y-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Histórico de Ações na Agenda
            </h3>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação registrada</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n: any) => (
                  <div key={n.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0">
                    <span className="text-lg mt-0.5">{notificationActionIcons[n.action] || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {notificationActionLabels[n.action] || n.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(n.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-0.5">{n.event_title}</p>
                      {n.details && <p className="text-xs text-muted-foreground">{n.details}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">por {n.actor_name || "Sistema"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="calendario" className="space-y-6">
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
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                  <Button
                    type="submit"
                    className="bg-gradient-primary"
                    disabled={isSubmitting || (useGoogleAsPrimary ? !composedTitle : !form.client_id)}
                  >
                    {isSubmitting ? "Criando..." : (useGoogleAsPrimary ? "Criar Evento" : "Agendar")}
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
        <div className="max-h-[70vh] overflow-auto" id="agenda-scroll-container">
          <TimeGrid
            events={dayEvents(selectedDate)}
            selectedDate={selectedDate}
            onSlotClick={handleDaySlotClick}
            onEventClick={(evt) => evt.type === 'google' ? handleEditEvent(evt) : undefined}
            onStatusChange={!useGoogleAsPrimary ? (id, status) => updateStatusMutation.mutate({ id, status }) : undefined}
          />
        </div>
      ) : view === "week" ? (
        <div className="max-h-[70vh] overflow-auto" id="agenda-scroll-container">
          <WeekTimeGrid
            days={weekDays}
            getEventsForDay={dayEvents}
            onSlotClick={handleSlotClick}
            onEventClick={(evt) => evt.type === 'google' ? handleEditEvent(evt) : undefined}
            isToday={isToday}
          />
        </div>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!editingEvent) return;
                          // Check if already billed via google_event_id
                          const { data: existing } = await supabase
                            .from("appointments")
                            .select("id")
                            .eq("clinic_id", profile?.clinic_id || "")
                            .eq("google_event_id", editingEvent.id)
                            .limit(1);
                          if (existing && existing.length > 0) {
                            toast.error("Este evento já foi faturado. Para refaturar, exclua a transação no módulo Financeiro primeiro.");
                            return;
                          }
                          setBillingEvent(editingEvent);
                          setIsBillingOpen(true);
                        }}
                        className="gap-1 text-xs"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        Faturar
                      </Button>
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
                            setCancelReason("");
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
                  {!isPast && !editEnabled && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      Evento em modo leitura. Clique em "Habilitar Edição" para alterar.
                    </div>
                  )}

                  {/* Procedimento */}
                  <div className="space-y-2">
                    <Label>Procedimento</Label>
                    <Select value={editForm.procedure_id} onValueChange={handleEditProcedureSelect} disabled={isDisabled}>
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

                  {/* Client fields — no origin field in edit */}
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Dados do Cliente</p>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Nome</Label>
                      <Input
                        value={editForm.clientName}
                        onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Nome do cliente"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</Label>
                      <Input
                        value={editForm.clientWhatsapp}
                        onChange={(e) => setEditForm({ ...editForm, clientWhatsapp: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="5511999999999"
                        disabled={isDisabled}
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
                        disabled={isDisabled}
                      />
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
                      disabled={isDisabled}
                    />
                  </div>

                  {/* Observações — always editable, but for past events only append */}
                  <div className="space-y-2">
                    <Label>Observações {isPast && <span className="text-xs text-muted-foreground">(adicionar novas)</span>}</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => {
                        if (isPast) {
                          const original = editingEvent?.description || '';
                          if (e.target.value.startsWith(original)) {
                            setEditForm({ ...editForm, description: e.target.value });
                          }
                        } else {
                          setEditForm({ ...editForm, description: e.target.value });
                        }
                      }}
                      rows={3}
                      disabled={isPast ? false : isDisabled}
                    />
                  </div>

                  {/* Date/Time */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} disabled={isDisabled} />
                    </div>
                    <div className="space-y-2">
                      <Label>Início</Label>
                      <Input type="time" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} disabled={isDisabled} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim</Label>
                      <Input type="time" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} disabled={isDisabled} />
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <div className="flex gap-2 ml-auto">
                    <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={editLoading}>
                      {isPast || !editEnabled ? 'Fechar' : 'Cancelar'}
                    </Button>
                    {isPast ? (
                      editForm.description !== (editingEvent?.description || '') && (
                        <Button onClick={handleSaveEdit} disabled={editLoading}>
                          {editLoading ? "Salvando..." : "Salvar Observações"}
                        </Button>
                      )
                    ) : editEnabled ? (
                      <Button onClick={handleSaveEdit} disabled={editLoading || !composedEditTitle}>
                        {editLoading ? "Salvando..." : "Salvar Evento"}
                      </Button>
                    ) : null}
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Cancel Event Confirmation with Reason */}
      <AlertDialog open={showCancelDialog} onOpenChange={(open) => { if (!open) setCancelReason(""); setShowCancelDialog(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o evento "{eventToDelete?.title}"? Esta ação não pode ser desfeita e o evento será removido do Google Calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo do cancelamento *</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Informe o motivo do cancelamento..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editLoading} onClick={() => setCancelReason("")}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelEvent}
              disabled={editLoading || !cancelReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {editLoading ? "Cancelando..." : "Sim, Cancelar Evento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Waiting List Suggestions Dialog */}
      <Dialog open={showWaitingSuggestions} onOpenChange={setShowWaitingSuggestions}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Pacientes na Lista de Espera
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Uma vaga foi liberada. Os seguintes pacientes da lista de espera podem ser compatíveis:</p>
          <div className="space-y-2 mt-2">
            {waitingSuggestions.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{w.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.procedures?.name || "Procedimento não especificado"}
                    {w.desired_date ? ` • ${w.desired_date}` : ""}
                    {w.time_range_start ? ` • ${w.time_range_start.slice(0,5)}–${w.time_range_end?.slice(0,5)}` : ""}
                  </p>
                  <Badge variant="outline" className={
                    w.priority === "urgencia" ? "bg-red-100 text-red-700 border-red-300" :
                    w.priority === "alta" ? "bg-orange-100 text-orange-700 border-orange-300" :
                    w.priority === "normal" ? "bg-blue-100 text-blue-700 border-blue-300" :
                    "bg-muted text-muted-foreground border-border"
                  }>
                    {w.priority === "urgencia" ? "Urgência" : w.priority === "alta" ? "Alta" : w.priority === "normal" ? "Normal" : "Baixa"}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 shrink-0 ml-2"
                  onClick={async () => {
                    const phone = w.client_phone || w.clients?.whatsapp || w.clients?.phone;
                    if (!phone) { toast.error("Paciente sem telefone"); return; }
                    const procName = w.procedures?.name || "consulta";
                    const msg = `Olá ${w.client_name}! Surgiu uma vaga para ${procName}. Deseja agendar? Responda SIM para confirmar.`;
                    try {
                      await supabase.functions.invoke("send-whatsapp", { body: { phoneNumber: phone, message: msg } });
                      await supabase.from("waiting_list").update({ status: "notificado", notified_at: new Date().toISOString() }).eq("id", w.id);
                      if (profile?.clinic_id) {
                        await supabase.from("waiting_list_history").insert({
                          waiting_list_id: w.id, clinic_id: profile.clinic_id,
                          action: "notificado", details: `Notificado via WhatsApp após cancelamento`, performed_by: profile?.id,
                        });
                      }
                      toast.success(`Notificação enviada para ${w.client_name}`);
                      setWaitingSuggestions(prev => prev.map(p => p.id === w.id ? { ...p, status: "notificado" } : p));
                    } catch (err: any) {
                      toast.error("Erro ao enviar: " + err.message);
                    }
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Notificar
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setShowWaitingSuggestions(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation (legacy) */}
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

      {/* Billing Dialog */}
      <BillingDialog
        open={isBillingOpen}
        onOpenChange={setIsBillingOpen}
        event={billingEvent}
        clinicId={profile?.clinic_id || ""}
      />
    </div>
      </TabsContent>
    </Tabs>
  );
};

// ===================== BILLING DIALOG =====================
interface SaleItem { stockId: string; name: string; qty: number; price: number; }
interface ExtraProcedure { procedureId: string; name: string; price: number; }

function BillingDialog({ open, onOpenChange, event, clinicId }: {
  open: boolean; onOpenChange: (o: boolean) => void; event: MergedEvent | null; clinicId: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: "receita", category: "atendimento", description: "",
    amount: "", payment_method: "pix", status: "pago",
    date: format(new Date(), "yyyy-MM-dd"), notes: "",
  });
  const [initialized, setInitialized] = useState(false);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [extraProcedures, setExtraProcedures] = useState<ExtraProcedure[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [procSearch, setProcSearch] = useState("");
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showProcPicker, setShowProcPicker] = useState(false);

  // Fetch stock items
  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock-for-billing", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, sale_price, cost_price, quantity, unit, category")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId && open,
  });

  // Fetch procedures
  const { data: billingProcedures = [] } = useQuery({
    queryKey: ["procedures-for-billing", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("procedures")
        .select("id, name, price")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId && open,
  });

  // Pre-fill from event
  useEffect(() => {
    if (open && event && !initialized) {
      const ep = event.extendedProperties;
      setForm({
        type: "receita",
        category: "atendimento",
        description: event.title || "",
        amount: ep?.procedureValue || "",
        payment_method: "pix",
        status: "pago",
        date: event.date || format(new Date(), "yyyy-MM-dd"),
        notes: "",
      });
      setSaleItems([]);
      setExtraProcedures([]);
      setInitialized(true);
    }
    if (!open) setInitialized(false);
  }, [open, event, initialized]);

  // Calculate total
  const baseAmount = parseFloat(form.amount) || 0;
  const itemsTotal = saleItems.reduce((s, i) => s + i.qty * i.price, 0);
  const procsTotal = extraProcedures.reduce((s, p) => s + p.price, 0);
  const grandTotal = baseAmount + itemsTotal + procsTotal;

  const filteredStock = useMemo(() => {
    const q = itemSearch.toLowerCase();
    return stockItems.filter((s: any) => s.name.toLowerCase().includes(q)).slice(0, 10);
  }, [stockItems, itemSearch]);

  const filteredProcs = useMemo(() => {
    const q = procSearch.toLowerCase();
    return billingProcedures.filter((p: any) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [billingProcedures, procSearch]);

  const addSaleItem = (item: any) => {
    const existing = saleItems.find(s => s.stockId === item.id);
    if (existing) {
      setSaleItems(saleItems.map(s => s.stockId === item.id ? { ...s, qty: s.qty + 1 } : s));
    } else {
      setSaleItems([...saleItems, {
        stockId: item.id,
        name: item.name,
        qty: 1,
        price: item.sale_price || 0,
      }]);
    }
    setItemSearch("");
    setShowItemPicker(false);
  };

  const addExtraProcedure = (proc: any) => {
    setExtraProcedures([...extraProcedures, {
      procedureId: proc.id,
      name: proc.name,
      price: proc.price || 0,
    }]);
    setProcSearch("");
    setShowProcPicker(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("Sem clínica");

      const ep = event?.extendedProperties;

      // === 1. Resolve client_id from extendedProperties ===
      let clientId: string | null = null;
      if (ep?.clientWhatsapp) {
        const { data: clientByPhone } = await supabase
          .from("clients")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("whatsapp", ep.clientWhatsapp)
          .maybeSingle();
        if (clientByPhone) clientId = clientByPhone.id;
      }
      if (!clientId && ep?.clientName) {
        const { data: clientByName } = await supabase
          .from("clients")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("name", ep.clientName)
          .maybeSingle();
        if (clientByName) clientId = clientByName.id;
      }

      // === 2. Resolve procedure_id from extendedProperties ===
      let procedureId: string | null = null;
      if (ep?.procedureName) {
        const { data: procByName } = await supabase
          .from("procedures")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("name", ep.procedureName)
          .maybeSingle();
        if (procByName) procedureId = procByName.id;
      }

      // === 3. Create appointment record (links Google event to local data) ===
      let appointmentId: string | null = null;
      if (clientId && event) {
        const durationMatch = event.duration?.match(/(\d+)/);
        const durationMin = durationMatch ? parseInt(durationMatch[1]) : 30;

        const { data: newAppt } = await supabase
          .from("appointments")
          .insert({
            clinic_id: clinicId,
            client_id: clientId,
            procedure_id: procedureId,
            date: event.date,
            start_time: event.time + ":00",
            duration_minutes: durationMin,
            estimated_price: parseFloat(form.amount) || null,
            status: "confirmado",
            notes: `Faturado via Google Calendar: ${event.title}`,
            google_event_id: event.id,
          })
          .select("id")
          .single();
        if (newAppt) appointmentId = newAppt.id;
      }

      // === 4. Create or find existing medical_record ===
      if (clientId) {
        const { data: existingRecord } = await supabase
          .from("medical_records")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("client_id", clientId)
          .maybeSingle();

        if (!existingRecord) {
          await supabase.from("medical_records").insert({
            clinic_id: clinicId,
            client_id: clientId,
            appointment_id: appointmentId,
            date: event?.date || format(new Date(), "yyyy-MM-dd"),
          });
        }
      }

      // === 5. Create extra procedure appointments ===
      const extraApptIds: string[] = [];
      if (clientId) {
        for (const proc of extraProcedures) {
          const { data: extraAppt } = await supabase.from("appointments").insert({
            clinic_id: clinicId,
            client_id: clientId,
            procedure_id: proc.procedureId,
            date: event?.date || form.date,
            start_time: event?.time ? event.time + ":00" : "00:00:00",
            duration_minutes: 30,
            estimated_price: proc.price,
            status: "confirmado",
            notes: `Procedimento adicional faturado: ${proc.name}`,
            parent_appointment_id: appointmentId || null,
            google_event_id: event?.id || null,
          }).select("id").single();
          if (extraAppt) extraApptIds.push(extraAppt.id);
        }
      }

      // === 6. Financial transactions (existing logic) ===
      // Main transaction (atendimento)
      const { error } = await supabase.from("financial_transactions").insert({
        clinic_id: clinicId,
        type: form.type,
        category: form.category,
        description: form.description,
        amount: baseAmount,
        payment_method: form.payment_method,
        status: form.status,
        date: form.date,
        notes: form.notes || null,
        client_id: clientId,
        appointment_id: appointmentId,
      });
      if (error) throw error;

      // Product sale transactions + stock deduction
      for (const item of saleItems) {
        await supabase.from("financial_transactions").insert({
          clinic_id: clinicId,
          type: "receita",
          category: "produto",
          description: `Venda: ${item.name}`,
          amount: item.qty * item.price,
          payment_method: form.payment_method,
          status: form.status,
          date: form.date,
          client_id: clientId,
          appointment_id: appointmentId,
        });
        // Deduct stock
        const stockItem = stockItems.find((s: any) => s.id === item.stockId);
        if (stockItem) {
          await supabase.from("stock_items").update({
            quantity: (stockItem as any).quantity - item.qty,
          }).eq("id", item.stockId);
        }
      }

      // Extra procedure transactions
      for (const proc of extraProcedures) {
        await supabase.from("financial_transactions").insert({
          clinic_id: clinicId,
          type: "receita",
          category: "atendimento",
          description: `Procedimento adicional: ${proc.name}`,
          amount: proc.price,
          payment_method: form.payment_method,
          status: form.status,
          date: form.date,
          client_id: clientId,
        });
      }

      // === 7. Update all appointments to "compareceu" (trigger won't duplicate because transactions already exist) ===
      const apptIdsToUpdate = [appointmentId].filter(Boolean);
      if (clientId) {
        const { data: extraAppts } = await supabase
          .from("appointments")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("client_id", clientId)
          .eq("status", "confirmado")
          .ilike("notes", "%faturado%");
        if (extraAppts) {
          apptIdsToUpdate.push(...extraAppts.map((a: any) => a.id));
        }
      }
      if (apptIdsToUpdate.length > 0) {
        await supabase
          .from("appointments")
          .update({ status: "compareceu" })
          .in("id", apptIdsToUpdate);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-daily"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      toast.success("Faturamento realizado com sucesso!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Faturar Evento
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendimento">Atendimento</SelectItem>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="aluguel">Aluguel</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="salario">Salário</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Principal (R$) *</Label>
              <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>

          {/* Sale Items Section */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <Label className="flex items-center gap-1 text-sm font-medium">
              <ShoppingCart className="w-4 h-4" /> Venda de Itens (Estoque)
            </Label>
            {saleItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{item.name}</span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  className="w-16 h-7 text-xs"
                  value={item.qty}
                  onChange={(e) => {
                    const updated = [...saleItems];
                    updated[idx].qty = parseInt(e.target.value) || 1;
                    setSaleItems(updated);
                  }}
                />
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  type="number"
                  step="0.01"
                  className="w-20 h-7 text-xs"
                  value={item.price}
                  onChange={(e) => {
                    const updated = [...saleItems];
                    updated[idx].price = parseFloat(e.target.value) || 0;
                    setSaleItems(updated);
                  }}
                />
                <span className="text-xs font-medium w-20 text-right">R$ {(item.qty * item.price).toFixed(2)}</span>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSaleItems(saleItems.filter((_, i) => i !== idx))}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Popover open={showItemPicker} onOpenChange={setShowItemPicker}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Adicionar Item
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar item..." value={itemSearch} onValueChange={setItemSearch} />
                  <CommandList>
                    <CommandEmpty>Nenhum item encontrado</CommandEmpty>
                    <CommandGroup>
                      {filteredStock.map((s: any) => (
                        <CommandItem key={s.id} onSelect={() => addSaleItem(s)} className="flex justify-between">
                          <span>{s.name}</span>
                          <span className="text-xs text-muted-foreground">R$ {Number(s.sale_price || 0).toFixed(2)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Extra Procedures Section */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <Label className="flex items-center gap-1 text-sm font-medium">
              <Stethoscope className="w-4 h-4" /> Procedimentos Adicionais
            </Label>
            {extraProcedures.map((proc, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{proc.name}</span>
                <Input
                  type="number"
                  step="0.01"
                  className="w-24 h-7 text-xs"
                  value={proc.price}
                  onChange={(e) => {
                    const updated = [...extraProcedures];
                    updated[idx].price = parseFloat(e.target.value) || 0;
                    setExtraProcedures(updated);
                  }}
                />
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setExtraProcedures(extraProcedures.filter((_, i) => i !== idx))}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Popover open={showProcPicker} onOpenChange={setShowProcPicker}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Adicionar Procedimento
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar procedimento..." value={procSearch} onValueChange={setProcSearch} />
                  <CommandList>
                    <CommandEmpty>Nenhum procedimento encontrado</CommandEmpty>
                    <CommandGroup>
                      {filteredProcs.map((p: any) => (
                        <CommandItem key={p.id} onSelect={() => addExtraProcedure(p)} className="flex justify-between">
                          <span>{p.name}</span>
                          <span className="text-xs text-muted-foreground">R$ {Number(p.price).toFixed(2)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Grand Total */}
          {(saleItems.length > 0 || extraProcedures.length > 0) && (
            <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/20">
              <span className="text-sm font-medium">Total Geral</span>
              <span className="text-lg font-bold text-primary">R$ {grandTotal.toFixed(2)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentMethods).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-gradient-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Criar Transação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AgendaModule;
