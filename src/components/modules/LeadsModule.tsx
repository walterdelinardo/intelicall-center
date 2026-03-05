import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TrendingUp, Plus, Search, Phone, Mail, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { key: "novo", label: "Novo", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { key: "contato", label: "Contato", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { key: "agendamento", label: "Agendamento", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { key: "convertido", label: "Convertido", color: "bg-green-100 text-green-700 border-green-300" },
  { key: "perdido", label: "Perdido", color: "bg-red-100 text-red-700 border-red-300" },
];

const SOURCES = ["manual", "whatsapp", "instagram", "facebook", "google", "indicação", "site", "outro"];

const emptyForm = { name: "", phone: "", whatsapp: "", email: "", source: "manual", stage: "novo", notes: "" };

const LeadsModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("todos");
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      const payload = {
        clinic_id: profile.clinic_id,
        name: form.name,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        source: form.source,
        stage: form.stage,
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(editId ? "Lead atualizado!" : "Lead adicionado!");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Etapa atualizada!");
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (lead: any) => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      // Create client from lead
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({
          clinic_id: profile.clinic_id,
          name: lead.name,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          email: lead.email,
          lead_source: lead.source,
        })
        .select("id")
        .single();
      if (clientErr) throw clientErr;
      // Update lead
      const { error } = await supabase.from("leads").update({ stage: "convertido", converted_client_id: client.id }).eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Lead convertido em cliente!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead removido!");
    },
  });

  const openEdit = (lead: any) => {
    setEditId(lead.id);
    setForm({
      name: lead.name, phone: lead.phone || "", whatsapp: lead.whatsapp || "",
      email: lead.email || "", source: lead.source || "manual", stage: lead.stage, notes: lead.notes || "",
    });
    setIsOpen(true);
  };

  const closeDialog = () => { setIsOpen(false); setEditId(null); setForm(emptyForm); };

  const filtered = leads.filter((l: any) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || (l.phone || "").includes(search);
    const matchStage = stageFilter === "todos" || l.stage === stageFilter;
    return matchSearch && matchStage;
  });

  const stageCount = (key: string) => leads.filter((l: any) => l.stage === key).length;

  return (
    <div className="space-y-6">
      {/* Funnel Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STAGES.map((s) => (
          <Card key={s.key} className={`shadow-card cursor-pointer border-2 transition-colors ${stageFilter === s.key ? "border-primary" : "border-transparent"}`} onClick={() => setStageFilter(stageFilter === s.key ? "todos" : s.key)}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground">{stageCount(s.key)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar lead..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={isOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setIsOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary gap-2 shadow-card"><Plus className="w-4 h-4" /> Novo Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar Lead" : "Novo Lead"}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Etapa</Label>
                  <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" className="bg-gradient-primary" disabled={saveMutation.isPending || !form.name}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lead Cards */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-card"><CardContent className="p-8 text-center text-muted-foreground">Nenhum lead encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((lead: any) => {
            const stage = STAGES.find((s) => s.key === lead.stage);
            return (
              <Card key={lead.id} className="shadow-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-foreground">{lead.name}</p>
                      <Badge variant="outline" className={`text-xs mt-1 ${stage?.color || ""}`}>{stage?.label || lead.stage}</Badge>
                    </div>
                    <Badge variant="secondary" className="text-xs">{lead.source}</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {lead.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</p>}
                    {lead.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</p>}
                  </div>
                  {/* Stage buttons */}
                  <div className="flex gap-1 flex-wrap">
                    {STAGES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => updateStageMutation.mutate({ id: lead.id, stage: s.key })}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                          lead.stage === s.key ? s.color + " font-semibold" : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {/* Actions */}
                  <div className="flex gap-1 pt-1 border-t border-border">
                    <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => openEdit(lead)}>
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                    {lead.stage !== "convertido" && (
                      <Button size="sm" variant="ghost" className="gap-1 text-xs text-green-700" onClick={() => convertMutation.mutate(lead)}>
                        <UserPlus className="w-3 h-3" /> Converter
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive ml-auto">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(lead.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeadsModule;
