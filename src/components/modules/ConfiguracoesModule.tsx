import { useState, useEffect, useCallback } from "react";
import TelegramBotsSection from "@/components/settings/TelegramBotsSection";
import { fetchViaCep } from "@/lib/viaCep";
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
import { Settings, Building2, Clock, Phone, MapPin, Mail, Save, Loader2, Smartphone, Plus, Power, Plug, Trash2, Calendar, Pencil, Palette, Check, Globe, QrCode, Wifi, WifiOff, Activity, Upload, ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type GoogleCalendarOption } from "@/hooks/useGoogleOAuth";
import { toast } from "sonner";
import { useWhatsAppInboxes } from "@/hooks/useWhatsApp";
import { useGoogleOAuth } from "@/hooks/useGoogleOAuth";
import { GoogleOAuthConfigDialog } from "@/components/modules/GoogleOAuthConfigDialog";
import { GoogleMapsConfigDialog } from "@/components/modules/GoogleMapsConfigDialog";

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
  const { profile, isSuperAdmin, hasTabAccess, hasModuleAccess } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = isSuperAdmin || hasModuleAccess("configuracoes", "edit");
  const { inboxes, loading: inboxesLoading, createInbox, toggleInbox, deleteInbox } = useWhatsAppInboxes();
  const { accounts: googleAccounts, loading: googleLoading, initiateOAuth, toggleAccount: toggleGoogleAccount, deleteAccount: deleteGoogleAccount, fetchCalendars, updateCalendarId, updateLabel, updateColor, hasCredentials, fetchOAuthConfig } = useGoogleOAuth();

  const [showAddInbox, setShowAddInbox] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingInbox, setSavingInbox] = useState(false);
  const [calendarsMap, setCalendarsMap] = useState<Record<string, GoogleCalendarOption[]>>({});
  const [loadingCalendars, setLoadingCalendars] = useState<Record<string, boolean>>({});

  // Fetch podólogo profiles for Google Calendar label selector
  const { data: podologoProfiles } = useQuery({
    queryKey: ["podologo-profiles", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      // Get role definitions that match "podologo" slug
      const { data: roleDefs } = await supabase
        .from("role_definitions")
        .select("id")
        .eq("clinic_id", profile.clinic_id)
        .ilike("slug", "%podologo%");
      if (!roleDefs || roleDefs.length === 0) return [];
      const roleIds = roleDefs.map(r => r.id);
      // Get user IDs with those roles
      const { data: assignments } = await supabase
        .from("user_role_assignments")
        .select("user_id")
        .in("role_definition_id", roleIds);
      if (!assignments || assignments.length === 0) return [];
      const userIds = [...new Set(assignments.map(a => a.user_id))];
      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds)
        .eq("is_active", true);
      return profiles || [];
    },
    enabled: !!profile?.clinic_id,
  });
  const [showGoogleConfig, setShowGoogleConfig] = useState(false);
  const [showMapsConfig, setShowMapsConfig] = useState(false);

  // Instance status & QR Code states
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceLabel, setQrInstanceLabel] = useState("");
  const [statuses, setStatuses] = useState<Record<string, { state: string; loading: boolean }>>({});
  const [downtimeLogs, setDowntimeLogs] = useState<Array<{ id: string; instance_name: string; down_at: string; up_at: string | null; duration_seconds: number | null }>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const checkInstanceStatus = useCallback(async (instanceName: string, inboxId: string) => {
    setStatuses(prev => ({ ...prev, [inboxId]: { state: prev[inboxId]?.state || "unknown", loading: true } }));
    try {
      const { data, error } = await supabase.functions.invoke("evolution-instance-status", {
        body: { action: "status", instanceName },
      });
      if (error) throw error;
      setStatuses(prev => ({ ...prev, [inboxId]: { state: data?.state || "unknown", loading: false } }));
    } catch {
      setStatuses(prev => ({ ...prev, [inboxId]: { state: "error", loading: false } }));
    }
  }, []);

  const fetchDowntimeLogs = useCallback(async () => {
    if (!profile?.clinic_id) return;
    setLoadingLogs(true);
    try {
      const { data } = await supabase
        .from("instance_downtime_logs" as any)
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("down_at", { ascending: false })
        .limit(20);
      setDowntimeLogs((data as any) || []);
    } catch { /* ignore */ } finally {
      setLoadingLogs(false);
    }
  }, [profile?.clinic_id]);

  const handleGenerateQR = async (instanceName: string, label: string) => {
    setQrInstanceLabel(label);
    setQrDialogOpen(true);
    setQrLoading(true);
    setQrData(null);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-instance-status", {
        body: { action: "qrcode", instanceName },
      });
      if (error) throw error;
      const base64 = data?.base64 || data?.qrcode?.base64 || null;
      setQrData(base64);
      if (!base64) toast.info("A instância já está conectada ou não retornou QR Code.");
    } catch (err: any) {
      toast.error("Erro ao gerar QR Code: " + err.message);
    } finally {
      setQrLoading(false);
    }
  };

  const getStatusBadge = (inboxId: string, isActive: boolean) => {
    if (!isActive) return <Badge variant="secondary">Inativo</Badge>;
    const status = statuses[inboxId];
    if (!status || status.loading) return <Badge variant="outline" className="animate-pulse">Verificando...</Badge>;
    if (status.state === "open") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200"><Wifi className="w-3 h-3 mr-1" />Online</Badge>;
    if (status.state === "close" || status.state === "connecting") return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" />Offline</Badge>;
    return <Badge variant="secondary">Desconhecido</Badge>;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}min`;
  };

  // Check statuses on mount & poll every 30s
  useEffect(() => {
    if (inboxes.length > 0) {
      inboxes.forEach(inbox => checkInstanceStatus(inbox.instance_name, inbox.id));
    }
  }, [inboxes.length]);

  useEffect(() => {
    fetchDowntimeLogs();
  }, [fetchDowntimeLogs]);

  useEffect(() => {
    if (inboxes.length === 0) return;
    const interval = setInterval(() => {
      inboxes.forEach(inbox => checkInstanceStatus(inbox.instance_name, inbox.id));
    }, 30000);
    return () => clearInterval(interval);
  }, [inboxes]);
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
    address_number: "",
    address_complement: "",
    location_url: "",
    city: "",
    state: "",
    zip_code: "",
    neighborhood: "",
    theme_color: "#3B82F6",
    cnpj: "",
  });


  const [workingHours, setWorkingHours] = useState<WorkingHours>(defaultWorkingHours);

  useEffect(() => {
    if (clinic) {
      setForm({
        name: clinic.name || "",
        phone: clinic.phone || "",
        email: clinic.email || "",
        address: clinic.address || "",
        address_number: (clinic as any).address_number || "",
        address_complement: (clinic as any).address_complement || "",
        location_url: (clinic as any).location_url || "",
        city: clinic.city || "",
        state: clinic.state || "",
        zip_code: clinic.zip_code || "",
        neighborhood: (clinic as any).neighborhood || "",
        theme_color: clinic.theme_color || "#3B82F6",
        cnpj: (clinic as any).cnpj || "",
      });
      if (clinic.working_hours) {
        setWorkingHours(clinic.working_hours as unknown as WorkingHours);
      }
    }
  }, [clinic]);

  const handleClinicCepBlur = useCallback(async () => {
    const result = await fetchViaCep(form.zip_code);
    if (result) {
      setForm((prev) => ({
        ...prev,
        address: result.logradouro || prev.address,
        neighborhood: result.bairro || prev.neighborhood,
        city: result.localidade || prev.city,
        state: result.uf || prev.state,
      }));
    }
  }, [form.zip_code]);

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
          address_number: form.address_number || null,
          address_complement: form.address_complement || null,
          location_url: form.location_url || null,
          city: form.city || null,
          state: form.state || null,
          zip_code: form.zip_code || null,
          neighborhood: form.neighborhood || null,
          theme_color: form.theme_color || null,
          cnpj: form.cnpj || null,
        } as any)
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
      <Tabs defaultValue={["general", "hours", "whatsapp", "integrations"].filter(t => hasTabAccess("configuracoes", t))[0] || "general"}>
        <TabsList className="flex-wrap">
          {hasTabAccess("configuracoes", "general") && (
            <TabsTrigger value="general" className="gap-2">
              <Building2 className="w-4 h-4" /> Dados Gerais
            </TabsTrigger>
          )}
          {hasTabAccess("configuracoes", "hours") && (
            <TabsTrigger value="hours" className="gap-2">
              <Clock className="w-4 h-4" /> Horários
            </TabsTrigger>
          )}
          {hasTabAccess("configuracoes", "whatsapp") && (
            <TabsTrigger value="whatsapp" className="gap-2">
              <Smartphone className="w-4 h-4" /> WhatsApp
            </TabsTrigger>
          )}
          {hasTabAccess("configuracoes", "integrations") && (
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="w-4 h-4" /> Integrações
            </TabsTrigger>
          )}
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
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    Logotipo da Clínica
                  </Label>
                  <div className="flex items-center gap-4">
                    {clinic?.logo_url ? (
                      <img src={clinic.logo_url} alt="Logo" className="w-20 h-20 rounded-xl object-cover border border-border" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-dashed border-border flex items-center justify-center bg-muted/30">
                        <Building2 className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => document.getElementById("logo-upload-input")?.click()}
                      >
                        <Upload className="w-4 h-4" />
                        {clinic?.logo_url ? "Alterar Logo" : "Enviar Logo"}
                      </Button>
                      <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Recomendado: 256x256px</p>
                    </div>
                    <input
                      id="logo-upload-input"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !profile?.clinic_id) return;
                        const ext = file.name.split(".").pop() || "png";
                        const path = `${profile.clinic_id}/logo.${ext}`;
                        toast.info("Enviando logotipo...");
                        const { error: uploadError } = await supabase.storage
                          .from("clinic-logos")
                          .upload(path, file, { upsert: true });
                        if (uploadError) {
                          toast.error("Erro ao enviar: " + uploadError.message);
                          return;
                        }
                        const { data: urlData } = supabase.storage
                          .from("clinic-logos")
                          .getPublicUrl(path);
                        const logoUrl = urlData.publicUrl + "?t=" + Date.now();
                        const { error: updateError } = await supabase
                          .from("clinics")
                          .update({ logo_url: logoUrl } as any)
                          .eq("id", profile.clinic_id);
                        if (updateError) {
                          toast.error("Erro ao salvar URL: " + updateError.message);
                          return;
                        }
                        localStorage.setItem("clinic_logo_url", logoUrl);
                        localStorage.setItem("clinic_name", form.name);
                        queryClient.invalidateQueries({ queryKey: ["clinic"] });
                        queryClient.invalidateQueries({ queryKey: ["clinic-header"] });
                        toast.success("Logotipo atualizado!");
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>

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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={form.zip_code}
                      onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                      onBlur={handleClinicCepBlur}
                      placeholder="00000-000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Logradouro</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Logradouro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={form.address_number}
                      onChange={(e) => setForm({ ...form, address_number: e.target.value })}
                      placeholder="Nº"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      value={form.address_complement}
                      onChange={(e) => setForm({ ...form, address_complement: e.target.value })}
                      placeholder="Apto, sala, bloco..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={form.neighborhood}
                      onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                      placeholder="Bairro"
                    />
                  </div>
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
                </div>

                {/* Location URL */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    URL do Local (Google Maps)
                  </Label>
                  <Input
                    value={form.location_url}
                    onChange={(e) => setForm({ ...form, location_url: e.target.value })}
                    placeholder="https://maps.google.com/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Este link será usado como localização nos eventos do Google Calendar.
                  </p>
                </div>

                {/* Theme Color */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input
                      value={form.cnpj}
                      onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
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

        {/* WhatsApp QR Code Tab */}
        <TabsContent value="whatsapp">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Instâncias WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inboxesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : inboxes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma instância cadastrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Instância</TableHead>
                      <TableHead>Conexão</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inboxes.filter(i => i.is_active).map((inbox) => (
                      <TableRow key={inbox.id}>
                        <TableCell className="font-medium">{inbox.label}</TableCell>
                        <TableCell className="font-mono text-xs">{inbox.instance_name}</TableCell>
                        <TableCell>{getStatusBadge(inbox.id, inbox.is_active)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleGenerateQR(inbox.instance_name, inbox.label)}
                              title="Gerar QR Code"
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => checkInstanceStatus(inbox.instance_name, inbox.id)}
                              title="Verificar status"
                            >
                              <Activity className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
                          <TableHead>Agenda</TableHead>
                         <TableHead>Conexão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[120px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inboxes.map((inbox) => (
                          <TableRow key={inbox.id}>
                            <TableCell className="font-medium">{inbox.label}</TableCell>
                            <TableCell className="font-mono text-xs">{inbox.instance_name}</TableCell>
                            <TableCell>{inbox.phone_number || "—"}</TableCell>
                            <TableCell>
                              <Select
                                value={(inbox as any).google_calendar_account_id || "none"}
                                onValueChange={async (val) => {
                                  try {
                                    await supabase
                                      .from('whatsapp_inboxes')
                                      .update({ google_calendar_account_id: val === "none" ? null : val } as any)
                                      .eq('id', inbox.id);
                                    toast.success("Agenda vinculada!");
                                  } catch (e: any) {
                                    toast.error(e.message);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs w-[140px]">
                                  <Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                                  <SelectValue placeholder="Nenhuma" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nenhuma</SelectItem>
                                  {googleAccounts.filter(a => a.is_active).map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                      <span className="flex items-center gap-1.5">
                                        {acc.color && (
                                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                                        )}
                                        {acc.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(inbox.id, inbox.is_active)}
                            </TableCell>
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
                                  onClick={() => handleGenerateQR(inbox.instance_name, inbox.label)}
                                  title="Gerar QR Code"
                                >
                                  <QrCode className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => checkInstanceStatus(inbox.instance_name, inbox.id)}
                                  title="Verificar status"
                                >
                                  <Activity className="w-4 h-4" />
                                </Button>
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

          {/* Monitor de Disponibilidade */}
          <Card className="shadow-card mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Monitor de Disponibilidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : downtimeLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma queda registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instância</TableHead>
                      <TableHead>Início da Queda</TableHead>
                      <TableHead>Retorno</TableHead>
                      <TableHead>Tempo Fora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downtimeLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{log.instance_name}</TableCell>
                        <TableCell className="text-sm">{new Date(log.down_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-sm">
                          {log.up_at ? new Date(log.up_at).toLocaleString("pt-BR") : <Badge variant="destructive">Ainda fora</Badge>}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {log.duration_seconds ? formatDuration(log.duration_seconds) : <span className="text-destructive">Em andamento</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

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
                                {podologoProfiles && podologoProfiles.length > 0 ? (
                                  <Select
                                    value={acc.label}
                                    onValueChange={async (value) => {
                                      await updateLabel(acc.id, value);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs w-[180px]">
                                      <SelectValue placeholder="Selecionar podólogo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {podologoProfiles.map((p) => (
                                        <SelectItem key={p.id} value={p.full_name}>
                                          {p.full_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-sm text-muted-foreground">{acc.label}</span>
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
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      className="w-7 h-7 rounded-full border-2 border-border hover:scale-110 transition-transform"
                                      style={{ backgroundColor: acc.color || '#039BE5' }}
                                      title="Alterar cor"
                                    />
                                  </PopoverTrigger>
                                  <PopoverContent
                                    side="top"
                                    sideOffset={8}
                                    className="w-auto p-3"
                                    onPointerDownOutside={(e) => {
                                      // Prevent closing when native color picker dialog is open
                                      const target = e.target as HTMLElement;
                                      if (target?.closest?.('input[type="color"]')) {
                                        e.preventDefault();
                                      }
                                    }}
                                  >
                                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                                      {['#7986CB', '#33B679', '#8E24AA', '#E67C73', '#F6BF26', '#F4511E', '#039BE5', '#616161', '#3F51B5', '#0B8043', '#D50000', '#795548'].map((c) => (
                                        <button
                                          key={c}
                                          className={`w-7 h-7 rounded-full border-2 hover:scale-110 transition-transform ${acc.color === c ? 'border-foreground ring-2 ring-ring' : 'border-transparent'}`}
                                          style={{ backgroundColor: c }}
                                          onClick={() => updateColor(acc.id, c)}
                                        />
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                                      <Palette className="w-4 h-4 text-muted-foreground" />
                                      <label className="text-xs text-muted-foreground cursor-pointer flex items-center gap-2">
                                        Personalizada
                                        <input
                                          type="color"
                                          id={`color-input-${acc.id}`}
                                          defaultValue={acc.color || '#039BE5'}
                                          onChange={(e) => e.stopPropagation()}
                                          className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
                                        />
                                      </label>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-auto"
                                        onClick={() => {
                                          const input = document.getElementById(`color-input-${acc.id}`) as HTMLInputElement;
                                          if (input) {
                                            const newColor = input.value;
                                            if (newColor !== (acc.color || '#039BE5')) {
                                              updateColor(acc.id, newColor);
                                            }
                                          }
                                        }}
                                        title="Confirmar cor"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
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

          {/* Google Maps API Section */}
          <Card className="shadow-card mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Google Maps API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure as credenciais do Google Maps para calcular distâncias e tempos de transporte na Lista de Espera.
              </p>
              <div className="flex items-center gap-3">
                {(clinic as any)?.google_maps_api_key ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">✓ Configurada</Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Não configurada</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowMapsConfig(true)}>
                <Plus className="w-4 h-4 mr-1" /> {(clinic as any)?.google_maps_api_key ? "Atualizar Credenciais" : "Configurar Credenciais"}
              </Button>
              <GoogleMapsConfigDialog
                open={showMapsConfig}
                onOpenChange={setShowMapsConfig}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["clinic"] })}
              />
            </CardContent>
          </Card>

          {/* Bots Telegram */}
          <div className="mt-6">
            <TelegramBotsSection />
          </div>
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              QR Code — {qrInstanceLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            {qrLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : qrData ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`}
                  alt="QR Code"
                  className="w-64 h-64 rounded-lg border"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie este QR Code.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <Wifi className="w-10 h-10 text-emerald-500" />
                <p className="text-sm text-muted-foreground text-center">
                  A instância já está conectada ou não retornou um QR Code.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConfiguracoesModule;
