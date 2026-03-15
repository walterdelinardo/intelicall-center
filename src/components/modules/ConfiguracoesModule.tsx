import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Settings, Building2, Clock, Phone, MapPin, Mail, Save, Loader2, Smartphone, Plus, Power, Plug, Trash2, Calendar, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type GoogleCalendarOption } from "@/hooks/useGoogleOAuth";
import { toast } from "sonner";
import { useWhatsAppInboxes } from "@/hooks/useWhatsApp";
import { useGoogleOAuth } from "@/hooks/useGoogleOAuth";
import { GoogleOAuthConfigDialog } from "@/components/modules/GoogleOAuthConfigDialog";

const DAYS = [
  { key: "mon", label: "Segunda-feira" },
  { key: "tue", label: "Terça-feira" },
  { key: "wed", label: "Quarta-feira" },
  { key: "thu", label: "Quinta-feira" },
  { key: "fri", label: "Sexta-feira" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

interface WorkingHour {
  start: string;
  end: string;
}

type WorkingHours = Record<string, WorkingHour | null>;

const defaultWorkingHours: WorkingHours = {
  mon: { start: "08:00", end: "18:00" },
  tue: { start: "08:00", end: "18:00" },
  wed: { start: "08:00", end: "18:00" },
  thu: { start: "08:00", end: "18:00" },
  fri: { start: "08:00", end: "18:00" },
  sat: { start: "08:00", end: "12:00" },
  sun: null,
};

const ConfiguracoesModule = () => {
  const { profile, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasRole("admin");
  const { inboxes, loading: inboxesLoading, createInbox, toggleInbox, deleteInbox } = useWhatsAppInboxes();
  const { accounts: googleAccounts, loading: googleLoading, initiateOAuth, toggleAccount: toggleGoogleAccount, deleteAccount: deleteGoogleAccount, fetchCalendars, updateCalendarId, updateLabel, updateColor, hasCredentials, fetchOAuthConfig } = useGoogleOAuth();

  const [showAddInbox, setShowAddInbox] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingInbox, setSavingInbox] = useState(false);
  const [calendarsMap, setCalendarsMap] = useState<Record<string, GoogleCalendarOption[]>>({});
  const [loadingCalendars, setLoadingCalendars] = useState<Record<string, boolean>>({});
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");
  const [showGoogleConfig, setShowGoogleConfig] = useState(false);
  const { data: clinic, isLoading } = useQuery({
    queryKey: ["clinic", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return null;
      const { data, error } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", profile.clinic_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    theme_color: "#3B82F6",
  });

  const [workingHours, setWorkingHours] = useState<WorkingHours>(defaultWorkingHours);

  useEffect(() => {
    if (clinic) {
      setForm({
        name: clinic.name || "",
        phone: clinic.phone || "",
        email: clinic.email || "",
        address: clinic.address || "",
        city: clinic.city || "",
        state: clinic.state || "",
        zip_code: clinic.zip_code || "",
        theme_color: clinic.theme_color || "#3B82F6",
      });
      if (clinic.working_hours) {
        setWorkingHours(clinic.working_hours as unknown as WorkingHours);
      }
    }
  }, [clinic]);

  const updateClinicMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      const { error } = await supabase
        .from("clinics")
        .update({
          name: form.name,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip_code: form.zip_code || null,
          theme_color: form.theme_color || null,
        })
        .eq("id", profile.clinic_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic"] });
      toast.success("Dados da clínica atualizados!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateHoursMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      const { error } = await supabase
        .from("clinics")
        .update({ working_hours: workingHours as any })
        .eq("id", profile.clinic_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic"] });
      toast.success("Horários atualizados!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleDay = (dayKey: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayKey]: prev[dayKey] ? null : { start: "08:00", end: "18:00" },
    }));
  };

  const updateDayTime = (dayKey: string, field: "start" | "end", value: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayKey]: prev[dayKey] ? { ...prev[dayKey]!, [field]: value } : { start: "08:00", end: "18:00", [field]: value },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-8 text-center text-muted-foreground">
          Apenas administradores podem acessar as configurações.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="w-4 h-4" /> Dados Gerais
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="w-4 h-4" /> Horários
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="w-4 h-4" /> Integrações
          </TabsTrigger>
        </TabsList>

        {/* General Info Tab */}
        <TabsContent value="general">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Informações da Clínica
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateClinicMutation.mutate();
                }}
                className="space-y-6"
              >
                {/* Name */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    Nome da Clínica *
                  </Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nome da sua clínica"
                  />
                </div>

                {/* Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Telefone
                    </Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      E-mail
                    </Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="contato@clinica.com"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    Endereço
                  </Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      placeholder="UF"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={form.zip_code}
                      onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                      placeholder="00000-000"
                    />
                  </div>
                </div>

                {/* Theme Color */}
                <div className="space-y-2">
                  <Label>Cor do Tema</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.theme_color}
                      onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border border-border"
                    />
                    <span className="text-sm text-muted-foreground">{form.theme_color}</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-gradient-primary gap-2"
                    disabled={updateClinicMutation.isPending || !form.name}
                  >
                    {updateClinicMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar Dados
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Working Hours Tab */}
        <TabsContent value="hours">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Horário de Funcionamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {DAYS.map((day) => {
                  const isOpen = workingHours[day.key] !== null;
                  return (
                    <div
                      key={day.key}
                      className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                        isOpen ? "bg-card border-border" : "bg-muted/50 border-transparent"
                      }`}
                    >
                      <Switch checked={isOpen} onCheckedChange={() => toggleDay(day.key)} />
                      <span className={`w-36 font-medium text-sm ${isOpen ? "text-foreground" : "text-muted-foreground"}`}>
                        {day.label}
                      </span>
                      {isOpen ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            className="w-32"
                            value={workingHours[day.key]?.start || "08:00"}
                            onChange={(e) => updateDayTime(day.key, "start", e.target.value)}
                          />
                          <span className="text-muted-foreground">até</span>
                          <Input
                            type="time"
                            className="w-32"
                            value={workingHours[day.key]?.end || "18:00"}
                            onChange={(e) => updateDayTime(day.key, "end", e.target.value)}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Fechado</span>
                      )}
                    </div>
                  );
                })}

                <div className="flex justify-end pt-4">
                  <Button
                    className="bg-gradient-primary gap-2"
                    onClick={() => updateHoursMutation.mutate()}
                    disabled={updateHoursMutation.isPending}
                  >
                    {updateHoursMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar Horários
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Instâncias WhatsApp (Evolution API)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inboxesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <>
                  {inboxes.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Instância</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[80px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inboxes.map((inbox) => (
                          <TableRow key={inbox.id}>
                            <TableCell className="font-medium">{inbox.label}</TableCell>
                            <TableCell className="font-mono text-xs">{inbox.instance_name}</TableCell>
                            <TableCell>{inbox.phone_number || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={inbox.is_active ? "default" : "secondary"}>
                                {inbox.is_active ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={async () => {
                                    try {
                                      await toggleInbox(inbox.id, !inbox.is_active);
                                      toast.success(inbox.is_active ? "Instância desativada" : "Instância ativada");
                                    } catch (error: any) {
                                      toast.error("Erro: " + error.message);
                                    }
                                  }}
                                  title={inbox.is_active ? "Desativar" : "Ativar"}
                                >
                                  <Power className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={async () => {
                                    if (!confirm(`Excluir a instância "${inbox.label}"?`)) return;
                                    try {
                                      await deleteInbox(inbox.id);
                                      toast.success("Instância excluída");
                                    } catch (error: any) {
                                      toast.error("Erro: " + error.message);
                                    }
                                  }}
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {inboxes.length === 0 && !showAddInbox && (
                    <p className="text-sm text-muted-foreground">Nenhuma instância cadastrada.</p>
                  )}

                  {showAddInbox ? (
                    <div className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-medium text-sm">Nova Instância</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="new-label">Label *</Label>
                          <Input
                            id="new-label"
                            placeholder="Ex: Recepção"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="new-instance">Instance Name *</Label>
                          <Input
                            id="new-instance"
                            placeholder="Ex: demo-nw-1"
                            value={newInstanceName}
                            onChange={(e) => setNewInstanceName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="new-phone">Telefone</Label>
                          <Input
                            id="new-phone"
                            placeholder="Ex: 5511999999999"
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={savingInbox}
                          onClick={async () => {
                            if (!newInstanceName.trim() || !newLabel.trim()) {
                              toast.error("Preencha o nome da instância e o label");
                              return;
                            }
                            if (!profile?.clinic_id) {
                              toast.error("Clínica não encontrada");
                              return;
                            }
                            setSavingInbox(true);
                            try {
                              await createInbox({
                                instance_name: newInstanceName.trim(),
                                label: newLabel.trim(),
                                phone_number: newPhone.trim() || undefined,
                                clinic_id: profile.clinic_id,
                              });
                              toast.success("Instância adicionada com sucesso!");
                              setNewLabel("");
                              setNewInstanceName("");
                              setNewPhone("");
                              setShowAddInbox(false);
                            } catch (error: any) {
                              toast.error("Erro ao adicionar: " + error.message);
                            } finally {
                              setSavingInbox(false);
                            }
                          }}
                        >
                          {savingInbox ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowAddInbox(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setShowAddInbox(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Adicionar Instância
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Google Calendar Section */}
          <Card className="shadow-card mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Google Calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {googleLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <>
                  {googleAccounts.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Agenda</TableHead>
                          <TableHead>Cor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[80px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {googleAccounts.map((acc) => {
                          const calendars = calendarsMap[acc.id] || [];
                          const isLoadingCals = loadingCalendars[acc.id] || false;

                          const handleLoadCalendars = async () => {
                            if (calendars.length > 0) return;
                            setLoadingCalendars(prev => ({ ...prev, [acc.id]: true }));
                            try {
                              const cals = await fetchCalendars(acc.id);
                              setCalendarsMap(prev => ({ ...prev, [acc.id]: cals }));
                            } finally {
                              setLoadingCalendars(prev => ({ ...prev, [acc.id]: false }));
                            }
                          };

                          return (
                            <TableRow key={acc.id}>
                              <TableCell>
                                {editingLabel === acc.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editLabelValue}
                                      onChange={(e) => setEditLabelValue(e.target.value)}
                                      className="h-7 text-xs w-[140px]"
                                      autoFocus
                                      onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && editLabelValue.trim()) {
                                          await updateLabel(acc.id, editLabelValue.trim());
                                          setEditingLabel(null);
                                        }
                                        if (e.key === 'Escape') setEditingLabel(null);
                                      }}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={async () => {
                                        if (editLabelValue.trim()) {
                                          await updateLabel(acc.id, editLabelValue.trim());
                                          setEditingLabel(null);
                                        }
                                      }}
                                    >
                                      <Save className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    className="font-medium text-left hover:underline cursor-pointer"
                                    onClick={() => {
                                      setEditingLabel(acc.id);
                                      setEditLabelValue(acc.label);
                                    }}
                                    title="Clique para editar"
                                  >
                                    {acc.label} <Pencil className="w-3 h-3 inline ml-1 text-muted-foreground" />
                                  </button>
                                )}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={acc.calendar_id}
                                  onValueChange={async (value) => {
                                    try {
                                      await updateCalendarId(acc.id, value);
                                    } catch (e: any) {
                                      toast.error("Erro: " + e.message);
                                    }
                                  }}
                                  onOpenChange={(open) => {
                                    if (open) handleLoadCalendars();
                                  }}
                                >
                                  <SelectTrigger className="w-[200px] h-8 text-xs">
                                    <SelectValue placeholder={isLoadingCals ? "Carregando..." : acc.calendar_id === "primary" ? "Principal" : acc.calendar_id}>
                                      {isLoadingCals
                                        ? "Carregando..."
                                        : calendars.find(c => c.id === acc.calendar_id)?.summary
                                          || (acc.calendar_id === "primary" ? "Principal" : acc.calendar_id)}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {isLoadingCals ? (
                                      <div className="flex items-center justify-center p-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      </div>
                                    ) : calendars.length > 0 ? (
                                      calendars.map((cal) => (
                                        <SelectItem key={cal.id} value={cal.id}>
                                          <div className="flex items-center gap-2">
                                            {cal.backgroundColor && (
                                              <span
                                                className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                                                style={{ backgroundColor: cal.backgroundColor }}
                                              />
                                            )}
                                            <span>{cal.summary}{cal.primary ? " (Principal)" : ""}</span>
                                          </div>
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <div className="p-2 text-xs text-muted-foreground">
                                        Clique para carregar calendários
                                      </div>
                                    )}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="relative">
                                  <button
                                    className="w-7 h-7 rounded-full border-2 border-border hover:scale-110 transition-transform"
                                    style={{ backgroundColor: acc.color || '#039BE5' }}
                                    onClick={(e) => {
                                      const popover = (e.currentTarget.nextElementSibling as HTMLElement);
                                      popover.classList.toggle('hidden');
                                    }}
                                    title="Alterar cor"
                                  />
                                  <div data-color-popover={acc.id} className="hidden absolute z-50 top-9 left-0 bg-popover border border-border rounded-lg p-2 shadow-lg grid grid-cols-4 gap-1.5 w-[140px]">
                                    {['#7986CB', '#33B679', '#8E24AA', '#E67C73', '#F6BF26', '#F4511E', '#039BE5', '#616161', '#3F51B5', '#0B8043', '#D50000', '#795548'].map((c) => (
                                      <button
                                        key={c}
                                        className={`w-7 h-7 rounded-full border-2 hover:scale-110 transition-transform ${acc.color === c ? 'border-foreground ring-2 ring-ring' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                        onClick={async () => {
                                          await updateColor(acc.id, c);
                                          // Hide popover
                                          const popover = (document.querySelector(`[data-color-popover="${acc.id}"]`) as HTMLElement);
                                          if (popover) popover.classList.add('hidden');
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={acc.is_active ? "default" : "secondary"}>
                                  {acc.is_active ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      try {
                                        await toggleGoogleAccount(acc.id, !acc.is_active);
                                        toast.success(acc.is_active ? "Conta desativada" : "Conta ativada");
                                      } catch (error: any) {
                                        toast.error("Erro: " + error.message);
                                      }
                                    }}
                                    title={acc.is_active ? "Desativar" : "Ativar"}
                                  >
                                    <Power className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={async () => {
                                      if (!confirm(`Excluir a conta "${acc.label}"?`)) return;
                                      try {
                                        await deleteGoogleAccount(acc.id);
                                        toast.success("Conta excluída");
                                      } catch (error: any) {
                                        toast.error("Erro: " + error.message);
                                      }
                                    }}
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}

                  {googleAccounts.length === 0 && !hasCredentials && (
                    <p className="text-sm text-muted-foreground">Configure as credenciais do Google para conectar agendas.</p>
                  )}

                  {googleAccounts.length === 0 && hasCredentials && (
                    <p className="text-sm text-muted-foreground">Nenhuma conta Google Calendar conectada.</p>
                  )}

                  <Button variant="outline" size="sm" onClick={() => setShowGoogleConfig(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Conectar Conta Google
                  </Button>

                  <GoogleOAuthConfigDialog
                    open={showGoogleConfig}
                    onOpenChange={setShowGoogleConfig}
                    onSaved={() => fetchOAuthConfig()}
                    onConnect={() => initiateOAuth()}
                    hasCredentials={hasCredentials}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfiguracoesModule;
