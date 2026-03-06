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
import { Settings, Building2, Clock, Phone, MapPin, Mail, Save, Loader2, Smartphone, Plus, Power, Plug } from "lucide-react";
import { toast } from "sonner";
import { useWhatsAppInboxes } from "@/hooks/useWhatsApp";

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
  const { inboxes, loading: inboxesLoading, createInbox, toggleInbox } = useWhatsAppInboxes();

  const [showAddInbox, setShowAddInbox] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingInbox, setSavingInbox] = useState(false);

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
      </Tabs>
    </div>
  );
};

export default ConfiguracoesModule;
