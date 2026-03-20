import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardList, Plus, Search, Pencil, Trash2, MessageSquare, CalendarPlus, History, Phone, User, Clock } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITIES = [
  { value: "urgencia", label: "Urgência", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "alta", label: "Alta", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "baixa", label: "Baixa", color: "bg-muted text-muted-foreground border-border" },
];

const STATUSES = [
  { value: "aguardando", label: "Aguardando", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "notificado", label: "Notificado", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "confirmado", label: "Confirmado", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "agendado", label: "Agendado", color: "bg-primary/10 text-primary border-primary/30" },
  { value: "recusado", label: "Recusado", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "expirado", label: "Expirado", color: "bg-muted text-muted-foreground border-border" },
  { value: "cancelado", label: "Cancelado", color: "bg-muted text-muted-foreground border-border" },
];

const FLEXIBILITIES = [
  { value: "mesmo_dia", label: "Mesmo dia" },
  { value: "mesmo_semana", label: "Mesma semana" },
  { value: "qualquer_data", label: "Qualquer data" },
];

const ORIGINS = [
  { value: "manual", label: "Manual" },
  { value: "agenda", label: "Agenda" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Telefone" },
];

const emptyForm = {
  client_name: "", client_phone: "", client_id: "", procedure_id: "", google_calendar_account_id: "",
  desired_date: "", time_range_start: "", time_range_end: "",
  flexibility: "mesmo_dia", priority: "normal", origin: "manual", notes: "",
};

const ListaEsperaModule = () => {
  const { profile } = useAuth();
  const { openChatWithPhone } = useDashboard();
  const queryClient = useQueryClient();
  const { createEvent: createGoogleEvent } = useGoogleCalendar();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterProfessional, setFilterProfessional] = useState("all");
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  // Calendar accounts query
  const { data: calendarAccounts = [] } = useQuery({
    queryKey: ["calendar-accounts", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data } = await supabase.from("google_calendar_accounts").select("id, label, is_active").eq("clinic_id", profile.clinic_id).eq("is_active", true).order("label");
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  // Queries
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["waiting-list", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("waiting_list")
        .select("*, clients(name, phone, whatsapp), procedures(name), profiles(full_name)")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data } = await supabase.from("clients").select("id, name, phone, whatsapp").eq("clinic_id", profile.clinic_id).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ["procedures-list", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data } = await supabase.from("procedures").select("id, name").eq("clinic_id", profile.clinic_id).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals-list", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").eq("clinic_id", profile.clinic_id).eq("is_active", true).order("full_name");
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["waiting-list-history", historyId],
    queryFn: async () => {
      if (!historyId) return [];
      const { data } = await supabase
        .from("waiting_list_history")
        .select("*, profiles(full_name)")
        .eq("waiting_list_id", historyId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!historyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      const payload: any = {
        clinic_id: profile.clinic_id,
        client_name: form.client_name,
        client_phone: form.client_phone || null,
        client_id: form.client_id || null,
        procedure_id: form.procedure_id || null,
        google_calendar_account_id: form.google_calendar_account_id || null,
        desired_date: form.desired_date || null,
        time_range_start: form.time_range_start || null,
        time_range_end: form.time_range_end || null,
        flexibility: form.flexibility,
        priority: form.priority,
        origin: form.origin,
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("waiting_list").update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("waiting_list_history").insert({
          waiting_list_id: editId, clinic_id: profile.clinic_id,
          action: "editado", details: "Registro editado", performed_by: profile.id,
        });
      } else {
        const { data, error } = await supabase.from("waiting_list").insert(payload).select("id").single();
        if (error) throw error;
        await supabase.from("waiting_list_history").insert({
          waiting_list_id: data.id, clinic_id: profile.clinic_id,
          action: "criado", details: "Adicionado à lista de espera", performed_by: profile.id,
        });
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Registro atualizado" : "Adicionado à lista de espera");
      queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
      setIsOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteId) return;
      const { error } = await supabase.from("waiting_list").delete().eq("id", deleteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido");
      queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, details }: { id: string; status: string; details: string }) => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      const updatePayload: any = { status };
      if (status === "notificado") updatePayload.notified_at = new Date().toISOString();
      const { error } = await supabase.from("waiting_list").update(updatePayload).eq("id", id);
      if (error) throw error;
      await supabase.from("waiting_list_history").insert({
        waiting_list_id: id, clinic_id: profile.clinic_id,
        action: status, details, performed_by: profile.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleNotifyWhatsApp = async (item: any) => {
    const phone = item.client_phone || item.clients?.whatsapp || item.clients?.phone;
    if (!phone) {
      toast.error("Paciente sem telefone cadastrado");
      return;
    }
    const procedureName = item.procedures?.name || "consulta";
    const dateStr = item.desired_date ? format(new Date(item.desired_date + "T12:00:00"), "dd/MM/yyyy") : "em breve";
    const message = `Olá ${item.client_name}! Surgiu uma vaga para ${procedureName} no dia ${dateStr}. Deseja confirmar? Responda SIM para confirmar ou NÃO para recusar.`;

    try {
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: { phoneNumber: phone, message },
      });
      if (error) throw error;
      await updateStatusMutation.mutateAsync({ id: item.id, status: "notificado", details: `Notificado via WhatsApp: ${phone}` });
      toast.success("Notificação enviada via WhatsApp");
    } catch (err: any) {
      toast.error("Erro ao enviar notificação: " + err.message);
    }
  };

  const handleEdit = (item: any) => {
    setEditId(item.id);
    setForm({
      client_name: item.client_name,
      client_phone: item.client_phone || "",
      client_id: item.client_id || "",
      procedure_id: item.procedure_id || "",
      google_calendar_account_id: (item as any).google_calendar_account_id || "",
      desired_date: item.desired_date || "",
      time_range_start: item.time_range_start?.slice(0, 5) || "",
      time_range_end: item.time_range_end?.slice(0, 5) || "",
      flexibility: item.flexibility || "mesmo_dia",
      priority: item.priority || "normal",
      origin: item.origin || "manual",
      notes: item.notes || "",
    });
    setIsOpen(true);
  };

  const handleSelectClient = (client: any) => {
    setForm({ ...form, client_name: client.name, client_phone: client.whatsapp || client.phone || "", client_id: client.id });
    setClientPickerOpen(false);
  };

  const activeStatuses = new Set(["aguardando", "notificado", "confirmado"]);
  const priorityOrder = { urgencia: 0, alta: 1, normal: 2, baixa: 3 };
  const getDaysInQueue = (createdAt: string) => Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);

  const sortedItems = [...items].sort((a: any, b: any) => {
    // Active statuses first
    const aActive = activeStatuses.has(a.status) ? 0 : 1;
    const bActive = activeStatuses.has(b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    // Priority
    const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
    const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
    if (pa !== pb) return pa - pb;
    // Days in queue (most days first)
    const daysA = getDaysInQueue(a.created_at);
    const daysB = getDaysInQueue(b.created_at);
    if (daysA !== daysB) return daysB - daysA;
    // Distance (closest first)
    const distA = a.distance_km ?? 9999;
    const distB = b.distance_km ?? 9999;
    if (distA !== distB) return distA - distB;
    return 0;
  });

  const filtered = sortedItems.filter((item: any) => {
    const matchSearch = item.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || item.status === filterStatus;
    const matchPriority = filterPriority === "all" || item.priority === filterPriority;
    const matchProfessional = filterProfessional === "all" || item.professional_id === filterProfessional;
    return matchSearch && matchStatus && matchPriority && matchProfessional;
  });

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find(st => st.value === status);
    return <Badge variant="outline" className={s?.color || ""}>{s?.label || status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const p = PRIORITIES.find(pr => pr.value === priority);
    return <Badge variant="outline" className={p?.color || ""}>{p?.label || priority}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar paciente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterProfessional} onValueChange={setFilterProfessional}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Profissional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {professionals.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditId(null); setForm(emptyForm); setIsOpen(true); }} className="gap-1">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Aguardando</p>
            <p className="text-2xl font-bold text-foreground">{items.filter((i: any) => i.status === "aguardando").length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Notificados</p>
            <p className="text-2xl font-bold text-foreground">{items.filter((i: any) => i.status === "notificado").length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Agendados (convertidos)</p>
            <p className="text-2xl font-bold text-foreground">{items.filter((i: any) => i.status === "agendado").length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
            <p className="text-2xl font-bold text-foreground">
              {items.length > 0 ? Math.round((items.filter((i: any) => i.status === "agendado").length / items.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Data Desejada</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Dias na Fila</TableHead>
                  <TableHead>Distância</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhum registro na lista de espera</TableCell></TableRow>
                ) : filtered.map((item: any) => {
                  const daysInQueue = getDaysInQueue(item.created_at);
                  return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.client_name}</TableCell>
                    <TableCell className="text-sm">{item.client_phone || item.clients?.whatsapp || "—"}</TableCell>
                    <TableCell className="text-sm">{item.procedures?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{item.profiles?.full_name || "Qualquer"}</TableCell>
                    <TableCell className="text-sm">{item.desired_date ? format(new Date(item.desired_date + "T12:00:00"), "dd/MM/yy") : "—"}</TableCell>
                    <TableCell className="text-sm">
                      {item.time_range_start && item.time_range_end ? `${item.time_range_start.slice(0, 5)}–${item.time_range_end.slice(0, 5)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        daysInQueue > 14 ? "bg-red-100 text-red-700 border-red-300" :
                        daysInQueue > 7 ? "bg-orange-100 text-orange-700 border-orange-300" :
                        "bg-muted text-muted-foreground border-border"
                      }>
                        {daysInQueue}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.distance_km != null ? (
                        <div className="space-y-0.5">
                          <span className="font-medium">{Number(item.distance_km).toFixed(1)} km</span>
                          {item.driving_time_min != null && (
                            <p className="text-muted-foreground">🚗 {item.driving_time_min} min</p>
                          )}
                          {item.transit_time_min != null && (
                            <p className="text-muted-foreground">🚌 {item.transit_time_min} min</p>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {(item.status === "aguardando" || item.status === "notificado") && (
                          <Button size="icon" variant="ghost" title="Notificar via WhatsApp" onClick={() => handleNotifyWhatsApp(item)}>
                            <Phone className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                        {(item.client_phone || item.clients?.whatsapp || item.clients?.phone) && (
                          <Button size="icon" variant="ghost" title="Conversar no chat" onClick={() => openChatWithPhone(item.client_phone || item.clients?.whatsapp || item.clients?.phone, item.client_name)}>
                            <MessageSquare className="w-4 h-4 text-success" />
                          </Button>
                        )}
                        {(item.status === "aguardando" || item.status === "confirmado") && (
                          <Button size="icon" variant="ghost" title="Marcar como agendado" onClick={() => updateStatusMutation.mutate({ id: item.id, status: "agendado", details: "Convertido em agendamento" })}>
                            <CalendarPlus className="w-4 h-4 text-primary" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Editar" onClick={() => handleEdit(item)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Histórico" onClick={() => { setHistoryId(item.id); setHistoryOpen(true); }}>
                          <History className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Remover" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setEditId(null); setForm(emptyForm); } setIsOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Lista de Espera" : "Adicionar à Lista de Espera"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.client_name.trim()) { toast.error("Nome do paciente é obrigatório"); return; } saveMutation.mutate(); }} className="space-y-4">
            {/* Client picker */}
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <div className="flex gap-2">
                <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Nome do paciente" className="flex-1" />
                <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="icon"><User className="w-4 h-4" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum encontrado</CommandEmpty>
                        <CommandGroup>
                          {clients.map((c: any) => (
                            <CommandItem key={c.id} onSelect={() => handleSelectClient(c)}>
                              <User className="w-3 h-3 mr-2" />{c.name}
                              {c.whatsapp && <span className="ml-auto text-xs text-muted-foreground">{c.whatsapp}</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Procedimento</Label>
                <Select value={form.procedure_id} onValueChange={(v) => setForm({ ...form, procedure_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {procedures.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Agenda *</Label>
                <Select value={form.google_calendar_account_id} onValueChange={(v) => setForm({ ...form, google_calendar_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar agenda" /></SelectTrigger>
                  <SelectContent>
                    {calendarAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data Desejada</Label>
              <Input type="date" value={form.desired_date} onChange={(e) => setForm({ ...form, desired_date: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Horário Início</Label>
                <Input type="time" value={form.time_range_start} onChange={(e) => setForm({ ...form, time_range_start: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Horário Fim</Label>
                <Input type="time" value={form.time_range_end} onChange={(e) => setForm({ ...form, time_range_end: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Flexibilidade</Label>
                <Select value={form.flexibility} onValueChange={(v) => setForm({ ...form, flexibility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FLEXIBILITIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={form.origin} onValueChange={(v) => setForm({ ...form, origin: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORIGINS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{editId ? "Salvar" : "Adicionar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da lista de espera?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Histórico de Movimentações</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada</p>
            ) : history.map((h: any) => (
              <div key={h.id} className="flex items-start gap-3 border-b border-border pb-2 last:border-0">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium capitalize">{h.action}</p>
                  {h.details && <p className="text-xs text-muted-foreground">{h.details}</p>}
                  <p className="text-xs text-muted-foreground">{format(new Date(h.created_at), "dd/MM/yyyy HH:mm")} — {h.profiles?.full_name || "Sistema"}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListaEsperaModule;
