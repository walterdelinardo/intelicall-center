import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText, Plus, Search, Eye, Calendar, User, Footprints,
  Trash2, Upload, X, Edit, ArrowLeft, ClipboardList, FileUp,
  Brain, Loader2, Sparkles, ScrollText, ChevronDown, ChevronRight,
  Package, XCircle, Download, Printer, Save, History, AlertTriangle,
  CheckCircle, PlusCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ViewMode = "list" | "create" | "edit" | "view";

const ProntuariosModule = () => {
  const { profile } = useAuth();
  const { pendingProntuarioClientId, clearPendingProntuario } = useDashboard();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingProntuarioClientId) {
      setSelectedClientId(pendingProntuarioClientId);
      clearPendingProntuario();
    }
  }, [pendingProntuarioClientId, clearPendingProntuario]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("clients").select("id, name, phone, whatsapp")
        .eq("clinic_id", profile.clinic_id).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["medical-records", profile?.clinic_id, selectedClientId],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      let q = supabase
        .from("medical_records")
        .select("*, clients(name), profiles(full_name)")
        .eq("clinic_id", profile.clinic_id)
        .order("date", { ascending: false });
      if (selectedClientId) q = q.eq("client_id", selectedClientId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!profile?.clinic_id,
  });

  const uniqueByClient = records.reduce((acc: any[], rec: any) => {
    if (!acc.find((r: any) => r.client_id === rec.client_id)) acc.push(rec);
    return acc;
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medical_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      toast.success("Prontuário excluído!");
      setDeleteRecordId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = uniqueByClient.filter((r) =>
    !search || (r.clients?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.chief_complaint || "").toLowerCase().includes(search.toLowerCase())
  );

  const goToCreate = () => { setActiveRecordId(null); setViewMode("create"); };
  const goToEdit = (id: string) => { setActiveRecordId(id); setViewMode("edit"); };
  const goToView = (id: string) => { setActiveRecordId(id); setViewMode("view"); };
  const goToList = () => { setActiveRecordId(null); setViewMode("list"); };

  if (viewMode === "create" || viewMode === "edit") {
    return (
      <RecordFormInline
        clinicId={profile?.clinic_id || ""}
        userId={profile?.id || ""}
        userName={profile?.full_name || ""}
        clients={clients}
        editRecordId={viewMode === "edit" ? activeRecordId : null}
        onBack={goToList}
      />
    );
  }

  if (viewMode === "view" && activeRecordId) {
    return (
      <ViewRecordInline
        recordId={activeRecordId}
        clinicId={profile?.clinic_id || ""}
        onBack={goToList}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total de Prontuários</p>
            <p className="text-2xl font-bold text-foreground">{uniqueByClient.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Este Mês</p>
            <p className="text-2xl font-bold text-primary">
              {records.filter(r => {
                const d = new Date(r.date);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Pacientes Atendidos</p>
            <p className="text-2xl font-bold text-primary">
              {new Set(records.map(r => r.client_id)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar prontuário..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={selectedClientId || "all"} onValueChange={(v) => setSelectedClientId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os pacientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pacientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="bg-gradient-primary gap-2 shadow-card" onClick={goToCreate}>
          <Plus className="w-4 h-4" /> Novo Prontuário
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search || selectedClientId ? "Nenhum prontuário encontrado." : "Nenhum prontuário cadastrado."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="hidden md:table-cell">Queixa Principal</TableHead>
                  <TableHead className="hidden lg:table-cell">Profissional</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rec) => (
                  <TableRow key={rec.id} className="cursor-pointer" onClick={() => goToView(rec.id)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {rec.clients?.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(rec.date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                      {rec.chief_complaint || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{rec.profiles?.full_name || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => goToView(rec.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => goToEdit(rec.id)}>
                          <Edit className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteRecordId(rec.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
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

      <AlertDialog open={!!deleteRecordId} onOpenChange={(o) => !o && setDeleteRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Prontuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este prontuário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRecordId && deleteMutation.mutate(deleteRecordId)}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ===================== RECORD FORM INLINE (CREATE + EDIT) =====================
function RecordFormInline({ clinicId, userId, userName, clients, editRecordId, onBack }: {
  clinicId: string; userId: string; userName: string; clients: any[];
  editRecordId: string | null; onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("clinical");
  const [form, setForm] = useState({
    client_id: "", date: format(new Date(), "yyyy-MM-dd"),
    chief_complaint: "", clinical_notes: "", diagnosis: "",
    treatment_performed: "", recommendations: "",
  });
  const emptyFoot = { nail_condition: "", skin_condition: "", deformities: "", sensitivity: "", circulation: "", pain_level: "", observations: "" };
  const [leftFoot, setLeftFoot] = useState({ ...emptyFoot });
  const [rightFoot, setRightFoot] = useState({ ...emptyFoot });
  const [documents, setDocuments] = useState<{ file: File; title: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { data: existingRecord } = useQuery({
    queryKey: ["medical-record-edit", editRecordId],
    queryFn: async () => {
      if (!editRecordId) return null;
      const [recRes, footRes] = await Promise.all([
        supabase.from("medical_records").select("*").eq("id", editRecordId).single(),
        supabase.from("foot_assessments").select("*").eq("record_id", editRecordId),
      ]);
      if (recRes.error) throw recRes.error;
      return { record: recRes.data, feet: footRes.data || [] };
    },
    enabled: !!editRecordId,
  });

  if (existingRecord && !loaded) {
    const r = existingRecord.record;
    setForm({
      client_id: r.client_id, date: r.date,
      chief_complaint: r.chief_complaint || "", clinical_notes: r.clinical_notes || "",
      diagnosis: r.diagnosis || "", treatment_performed: r.treatment_performed || "",
      recommendations: r.recommendations || "",
    });
    const left = existingRecord.feet.find((f: any) => f.foot === "left");
    const right = existingRecord.feet.find((f: any) => f.foot === "right");
    if (left) setLeftFoot({ nail_condition: left.nail_condition || "", skin_condition: left.skin_condition || "", deformities: left.deformities || "", sensitivity: left.sensitivity || "", circulation: left.circulation || "", pain_level: left.pain_level != null ? String(left.pain_level) : "", observations: left.observations || "" });
    if (right) setRightFoot({ nail_condition: right.nail_condition || "", skin_condition: right.skin_condition || "", deformities: right.deformities || "", sensitivity: right.sensitivity || "", circulation: right.circulation || "", pain_level: right.pain_level != null ? String(right.pain_level) : "", observations: right.observations || "" });
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId || !form.client_id) throw new Error("Selecione um paciente");

      const recordData = {
        clinic_id: clinicId, client_id: form.client_id, professional_id: userId,
        date: form.date, chief_complaint: form.chief_complaint || null,
        clinical_notes: form.clinical_notes || null, diagnosis: form.diagnosis || null,
        treatment_performed: form.treatment_performed || null, recommendations: form.recommendations || null,
      };

      let recordId: string;
      if (editRecordId) {
        const { error } = await supabase.from("medical_records").update(recordData).eq("id", editRecordId);
        if (error) throw error;
        recordId = editRecordId;
        await supabase.from("foot_assessments").delete().eq("record_id", recordId);
      } else {
        const { data: existing } = await supabase
          .from("medical_records").select("id").eq("clinic_id", clinicId).eq("client_id", form.client_id).maybeSingle();
        if (existing) {
          const { error } = await supabase.from("medical_records").update(recordData).eq("id", existing.id);
          if (error) throw error;
          recordId = existing.id;
          await supabase.from("foot_assessments").delete().eq("record_id", recordId);
        } else {
          const { data: record, error } = await supabase.from("medical_records").insert(recordData).select("id").single();
          if (error) throw error;
          recordId = record.id;
        }
      }

      const footData = [
        { ...leftFoot, foot: "left" as const, record_id: recordId, pain_level: leftFoot.pain_level ? parseInt(leftFoot.pain_level) : null },
        { ...rightFoot, foot: "right" as const, record_id: recordId, pain_level: rightFoot.pain_level ? parseInt(rightFoot.pain_level) : null },
      ].filter(f => f.nail_condition || f.skin_condition || f.deformities || f.sensitivity || f.circulation || f.observations);

      if (footData.length > 0) {
        const { error: footErr } = await supabase.from("foot_assessments").insert(
          footData.map(f => ({
            record_id: f.record_id, foot: f.foot,
            nail_condition: f.nail_condition || null, skin_condition: f.skin_condition || null,
            deformities: f.deformities || null, sensitivity: f.sensitivity || null,
            circulation: f.circulation || null, pain_level: f.pain_level, observations: f.observations || null,
          }))
        );
        if (footErr) throw footErr;
      }

      for (const doc of documents) {
        const filePath = `${clinicId}/${recordId}/${Date.now()}_${doc.file.name}`;
        const { error: upErr } = await supabase.storage.from("record-photos").upload(filePath, doc.file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("record-photos").getPublicUrl(filePath);
        const fileType = doc.file.type.startsWith("image/") ? "image" : "document";
        await supabase.from("record_documents").insert({
          record_id: recordId, clinic_id: clinicId,
          file_url: urlData.publicUrl, title: doc.title || doc.file.name,
          file_type: fileType,
        });
      }

      // Audit log
      await supabase.from("record_audit_log").insert({
        record_id: recordId, clinic_id: clinicId, user_id: userId, user_name: userName,
        tab: "Ficha Clínica", action: editRecordId ? "EDIÇÃO" : "CRIAÇÃO",
        summary: editRecordId ? "Prontuário editado" : "Prontuário criado",
        details: recordData as any,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      toast.success(editRecordId ? "Prontuário atualizado!" : "Prontuário salvo!");
      onBack();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newDocs = Array.from(e.target.files).map(file => ({ file, title: file.name.replace(/\.[^/.]+$/, "") }));
      setDocuments([...documents, ...newDocs]);
    }
  };

  const FootForm = ({ data, setData, label }: { data: typeof leftFoot; setData: (d: typeof leftFoot) => void; label: string }) => (
    <div className="space-y-3">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <Footprints className="w-4 h-4 text-primary" /> {label}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Condição das Unhas</Label>
          <Textarea rows={2} value={data.nail_condition} onChange={(e) => setData({ ...data, nail_condition: e.target.value })} placeholder="Onicocriptose, micose, espessamento..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Condição da Pele</Label>
          <Textarea rows={2} value={data.skin_condition} onChange={(e) => setData({ ...data, skin_condition: e.target.value })} placeholder="Calos, fissuras, ressecamento..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Deformidades</Label>
          <Textarea rows={2} value={data.deformities} onChange={(e) => setData({ ...data, deformities: e.target.value })} placeholder="Joanete, dedo em garra..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sensibilidade</Label>
          <Input value={data.sensitivity} onChange={(e) => setData({ ...data, sensitivity: e.target.value })} placeholder="Normal, diminuída..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Circulação</Label>
          <Input value={data.circulation} onChange={(e) => setData({ ...data, circulation: e.target.value })} placeholder="Adequada, comprometida..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nível de Dor (0-10)</Label>
          <Input type="number" min="0" max="10" value={data.pain_level} onChange={(e) => setData({ ...data, pain_level: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Observações</Label>
        <Textarea rows={2} value={data.observations} onChange={(e) => setData({ ...data, observations: e.target.value })} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {editRecordId ? "Editar Prontuário" : "Novo Prontuário"}
        </h2>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="clinical">Ficha Clínica</TabsTrigger>
              <TabsTrigger value="feet">Avaliações</TabsTrigger>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="clinical" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Paciente *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Queixa Principal</Label>
                <Textarea value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} rows={2} placeholder="O que o paciente relata..." />
              </div>
              <div className="space-y-2">
                <Label>Anotações Clínicas</Label>
                <Textarea value={form.clinical_notes} onChange={(e) => setForm({ ...form, clinical_notes: e.target.value })} rows={3} placeholder="Observações do profissional..." />
              </div>
              <div className="space-y-2">
                <Label>Diagnóstico</Label>
                <Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Tratamento Realizado</Label>
                <Textarea value={form.treatment_performed} onChange={(e) => setForm({ ...form, treatment_performed: e.target.value })} rows={3} placeholder="Procedimentos executados..." />
              </div>
              <div className="space-y-2">
                <Label>Recomendações</Label>
                <Textarea value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} rows={2} placeholder="Orientações ao paciente..." />
              </div>
            </TabsContent>

            <TabsContent value="feet" className="space-y-6 mt-4">
              <FootForm data={leftFoot} setData={setLeftFoot} label="Pé Esquerdo" />
              <Separator />
              <FootForm data={rightFoot} setData={setRightFoot} label="Pé Direito" />
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="doc-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                    <FileUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Clique para anexar documentos ou imagens</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, PDF</p>
                  </div>
                </Label>
                <input id="doc-upload" type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleDocSelect} />
              </div>
              {documents.length > 0 && (
                <div className="space-y-3">
                  {documents.map((d, i) => (
                    <Card key={i} className="border">
                      <CardContent className="p-3 flex items-center gap-3">
                        <FileText className="w-8 h-8 text-primary shrink-0" />
                        <div className="flex-1">
                          <Input
                            value={d.title}
                            onChange={(e) => { const u = [...documents]; u[i].title = e.target.value; setDocuments(u); }}
                            className="h-8 text-sm"
                            placeholder="Título do documento"
                          />
                          <p className="text-xs text-muted-foreground mt-1">{d.file.name} — {(d.file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))}>
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-6">
            <Button variant="outline" onClick={onBack}>Cancelar</Button>
            <Button className="bg-gradient-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.client_id}>
              {saveMutation.isPending ? "Salvando..." : editRecordId ? "Atualizar Prontuário" : "Salvar Prontuário"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== VIEW RECORD INLINE =====================
function ViewRecordInline({ recordId, clinicId, onBack }: {
  recordId: string; clinicId: string; onBack: () => void;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [prescriptionForAppt, setPrescriptionForAppt] = useState<string | null>(null);
  const [prescriptionData, setPrescriptionData] = useState({ prescription: "", orientations: "", observations: "" });
  const [prescriptionSaved, setPrescriptionSaved] = useState(false);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [safetyResult, setSafetyResult] = useState<{ safe: boolean; warnings: string[] } | null>(null);

  // Editable clinical form state
  const [clinicalForm, setClinicalForm] = useState<any>(null);
  const [clinicalEditing, setClinicalEditing] = useState(false);

  // Assessments
  const [showNewAssessment, setShowNewAssessment] = useState(false);
  const [assessmentSearch, setAssessmentSearch] = useState("");
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>("all");
  const [newAssessmentTypeDialog, setNewAssessmentTypeDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeFields, setNewTypeFields] = useState<string[]>([""]);
  const [newAssessmentData, setNewAssessmentData] = useState<Record<string, string>>({});
  const [newAssessmentTypeId, setNewAssessmentTypeId] = useState("");

  // Audit log detail
  const [auditDetailId, setAuditDetailId] = useState<string | null>(null);

  const { data: record } = useQuery({
    queryKey: ["medical-record", recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_records")
        .select("*, clients(name, phone, whatsapp), profiles(full_name)")
        .eq("id", recordId).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!recordId,
  });

  // Initialize clinical form when record loads
  useEffect(() => {
    if (record && !clinicalForm) {
      setClinicalForm({
        chief_complaint: record.chief_complaint || "",
        clinical_notes: record.clinical_notes || "",
        diagnosis: record.diagnosis || "",
        treatment_performed: record.treatment_performed || "",
        recommendations: record.recommendations || "",
      });
    }
  }, [record, clinicalForm]);

  const { data: footAssessments = [] } = useQuery({
    queryKey: ["foot-assessments", recordId],
    queryFn: async () => {
      const { data, error } = await supabase.from("foot_assessments").select("*").eq("record_id", recordId);
      if (error) throw error;
      return data;
    },
    enabled: !!recordId,
  });

  // Generic assessments
  const { data: genericAssessments = [] } = useQuery({
    queryKey: ["assessments", recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*, assessment_types(name, fields)")
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!recordId,
  });

  // Assessment types
  const { data: assessmentTypes = [] } = useQuery({
    queryKey: ["assessment-types", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_types")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clinicId,
  });

  // Saved prescriptions
  const { data: savedPrescriptions = [] } = useQuery({
    queryKey: ["prescriptions", recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!recordId,
  });

  // Audit log
  const { data: auditLog = [] } = useQuery({
    queryKey: ["audit-log", recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("record_audit_log")
        .select("*")
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!recordId,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ["patient-procedures", record?.client_id],
    queryFn: async () => {
      if (!record?.client_id || !clinicId) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*, procedures(name, price, duration_minutes)")
        .eq("client_id", record.client_id)
        .eq("clinic_id", clinicId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!record?.client_id && !!clinicId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["patient-transactions", record?.client_id, clinicId],
    queryFn: async () => {
      if (!record?.client_id || !clinicId) return [];
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("client_id", record.client_id)
        .eq("clinic_id", clinicId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!record?.client_id && !!clinicId,
  });

  const { data: appointmentMaterials = [] } = useQuery({
    queryKey: ["appointment-materials", record?.client_id, clinicId],
    queryFn: async () => {
      if (!record?.client_id || !clinicId) return [];
      const { data: appts } = await supabase.from("appointments").select("id").eq("client_id", record.client_id).eq("clinic_id", clinicId);
      if (!appts || appts.length === 0) return [];
      const { data, error } = await supabase.from("appointment_materials").select("*").in("appointment_id", appts.map((a: any) => a.id));
      if (error) throw error;
      return data as any[];
    },
    enabled: !!record?.client_id && !!clinicId,
  });

  const groupedEvents = procedures.reduce((acc: Record<string, any[]>, appt: any) => {
    const key = appt.parent_appointment_id || appt.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(appt);
    return acc;
  }, {} as Record<string, any[]>);

  const eventList = Object.entries(groupedEvents).map(([eventId, appts]: [string, any[]]) => {
    const mainAppt = appts.find((a: any) => !a.parent_appointment_id) || appts.reduce((min: any, a: any) => a.seq_number < min.seq_number ? a : min, appts[0]);
    const statuses = appts.map((a: any) => a.status);
    let eventStatus = statuses[0];
    if (statuses.includes('cancelado') && statuses.every((s: string) => s === 'cancelado')) eventStatus = 'cancelado';
    else if (statuses.includes('compareceu')) eventStatus = 'compareceu';
    const totalValue = appts.reduce((sum: number, a: any) => sum + (Number(a.estimated_price) || Number(a.procedures?.price) || 0), 0);
    const eventTransactions = transactions.filter((tx: any) => appts.some((a: any) => a.id === tx.appointment_id) && tx.category === 'produto');
    const productTotal = eventTransactions.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
    return {
      key: eventId, date: mainAppt.date, time: mainAppt.start_time, seqNumber: mainAppt.seq_number,
      googleEventId: mainAppt.google_event_id, status: eventStatus, appointments: appts,
      totalValue: totalValue + productTotal, productTransactions: eventTransactions,
    };
  }).sort((a, b) => b.seqNumber - a.seqNumber);

  const { data: docs = [] } = useQuery({
    queryKey: ["record-documents", recordId],
    queryFn: async () => {
      const { data, error } = await supabase.from("record_documents").select("*").eq("record_id", recordId).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!recordId,
  });

  const { data: legacyPhotos = [] } = useQuery({
    queryKey: ["record-photos-legacy", recordId],
    queryFn: async () => {
      const { data, error } = await supabase.from("record_photos").select("*").eq("record_id", recordId).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!recordId,
  });

  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadDocMutation = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const filePath = `${clinicId}/${recordId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("record-photos").upload(filePath, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("record-photos").getPublicUrl(filePath);
        const fileType = file.type.startsWith("image/") ? "image" : "document";
        await supabase.from("record_documents").insert({
          record_id: recordId, clinic_id: clinicId,
          file_url: urlData.publicUrl, title: file.name.replace(/\.[^/.]+$/, ""),
          file_type: fileType,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-documents", recordId] });
      toast.success("Documento(s) anexado(s)!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("record_documents").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-documents", recordId] });
      setEditingTitleId(null);
      toast.success("Título atualizado!");
    },
  });

  const analyzeDocMutation = useMutation({
    mutationFn: async (doc: any) => {
      setAnalyzingId(doc.id);
      const { data, error } = await supabase.functions.invoke("analyze-document", {
        body: { document_id: doc.id, file_url: doc.file_url, file_type: doc.file_type, title: doc.title },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-documents", recordId] });
      toast.success("Análise concluída!");
      setAnalyzingId(null);
    },
    onError: (e: any) => { toast.error(e.message || "Erro na análise"); setAnalyzingId(null); },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("record_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-documents", recordId] });
      toast.success("Documento removido!");
    },
  });

  // Save clinical form
  const saveClinicalMutation = useMutation({
    mutationFn: async () => {
      if (!clinicalForm) return;
      const oldData = {
        chief_complaint: record?.chief_complaint || "",
        clinical_notes: record?.clinical_notes || "",
        diagnosis: record?.diagnosis || "",
        treatment_performed: record?.treatment_performed || "",
        recommendations: record?.recommendations || "",
      };
      const { error } = await supabase.from("medical_records").update({
        chief_complaint: clinicalForm.chief_complaint || null,
        clinical_notes: clinicalForm.clinical_notes || null,
        diagnosis: clinicalForm.diagnosis || null,
        treatment_performed: clinicalForm.treatment_performed || null,
        recommendations: clinicalForm.recommendations || null,
      }).eq("id", recordId);
      if (error) throw error;
      await supabase.from("record_audit_log").insert({
        record_id: recordId, clinic_id: clinicId, user_id: profile?.id || "", user_name: profile?.full_name || "",
        tab: "Ficha Clínica", action: "EDIÇÃO", summary: "Ficha clínica atualizada",
        details: { old: oldData, new: clinicalForm } as any,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-record", recordId] });
      queryClient.invalidateQueries({ queryKey: ["audit-log", recordId] });
      setClinicalEditing(false);
      toast.success("Ficha clínica atualizada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Save prescription with AI check
  const savePrescription = async (procedure?: any) => {
    if (!record || !profile) return;
    setSavingPrescription(true);
    setSafetyResult(null);
    try {
      // AI safety check
      const { data: safetyData } = await supabase.functions.invoke("check-prescription-safety", {
        body: {
          prescription: prescriptionData.prescription,
          orientations: prescriptionData.orientations,
          observations: prescriptionData.observations,
          patient_name: record.clients?.name,
          clinical_data: {
            chief_complaint: record.chief_complaint,
            clinical_notes: record.clinical_notes,
            diagnosis: record.diagnosis,
            treatment_performed: record.treatment_performed,
            recommendations: record.recommendations,
          },
        },
      });
      const safety = safetyData || { safe: true, warnings: [] };
      setSafetyResult(safety);

      // Save prescription
      const { error } = await supabase.from("prescriptions").insert({
        record_id: recordId,
        appointment_id: procedure?.id || null,
        clinic_id: clinicId,
        professional_id: profile.id,
        professional_name: profile.full_name,
        patient_name: record.clients?.name || "",
        procedure_name: procedure?.procedures?.name || null,
        prescription: prescriptionData.prescription || null,
        orientations: prescriptionData.orientations || null,
        observations: prescriptionData.observations || null,
        ai_safety_check: safety.warnings?.length > 0 ? safety.warnings.join("; ") : null,
      });
      if (error) throw error;

      // Audit log
      await supabase.from("record_audit_log").insert({
        record_id: recordId, clinic_id: clinicId, user_id: profile.id, user_name: profile.full_name,
        tab: "Procedimentos", action: "CRIAÇÃO", summary: "Receituário criado",
        details: { procedure: procedure?.procedures?.name, ...prescriptionData } as any,
      });

      queryClient.invalidateQueries({ queryKey: ["prescriptions", recordId] });
      queryClient.invalidateQueries({ queryKey: ["audit-log", recordId] });
      setPrescriptionSaved(true);
      toast.success("Receituário salvo!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar receituário");
    } finally {
      setSavingPrescription(false);
    }
  };

  const printPrescription = (procedure?: any) => {
    if (!record) return;
    const procedureName = procedure?.procedures?.name || "—";
    const procedureDate = procedure ? format(new Date(procedure.date), "dd/MM/yyyy", { locale: ptBR }) : format(new Date(record.date), "dd/MM/yyyy", { locale: ptBR });
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Receita</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto}h1{font-size:18px;text-align:center;border-bottom:2px solid #000;padding-bottom:10px}
      .field{margin:16px 0}.label{font-weight:bold;font-size:12px;color:#555;margin-bottom:4px}.value{font-size:14px;white-space:pre-wrap}
      .signature{margin-top:60px;text-align:center;border-top:1px solid #000;padding-top:8px;width:250px;margin-left:auto;margin-right:auto}</style></head><body>
      <h1>RECEITUÁRIO</h1>
      <div class="field"><div class="label">Paciente</div><div class="value">${record.clients?.name || "—"}</div></div>
      <div class="field"><div class="label">Data</div><div class="value">${procedureDate}</div></div>
      <div class="field"><div class="label">Profissional</div><div class="value">${profile?.full_name || "—"}</div></div>
      <div class="field"><div class="label">Procedimento</div><div class="value">${procedureName}</div></div>
      <hr/>
      <div class="field"><div class="label">PRESCRIÇÃO</div><div class="value">${prescriptionData.prescription || "(vazio)"}</div></div>
      <div class="field"><div class="label">ORIENTAÇÕES AO PACIENTE</div><div class="value">${prescriptionData.orientations || "(vazio)"}</div></div>
      <div class="field"><div class="label">OBSERVAÇÕES</div><div class="value">${prescriptionData.observations || "(vazio)"}</div></div>
      <div class="signature">${profile?.full_name || ""}<br/>Assinatura do Profissional</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleUploadForProcedure = async (files: FileList, appointmentId: string) => {
    for (const file of Array.from(files)) {
      const filePath = `${clinicId}/${recordId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("record-photos").upload(filePath, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("record-photos").getPublicUrl(filePath);
      const fileType = file.type.startsWith("image/") ? "image" : "document";
      await supabase.from("record_documents").insert({
        record_id: recordId, clinic_id: clinicId,
        file_url: urlData.publicUrl, title: file.name.replace(/\.[^/.]+$/, ""),
        file_type: fileType,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["record-documents", recordId] });
    toast.success("Documento anexado ao procedimento!");
  };

  // Save new assessment type
  const saveAssessmentTypeMutation = useMutation({
    mutationFn: async () => {
      if (!newTypeName.trim()) throw new Error("Nome obrigatório");
      const fields = newTypeFields.filter(f => f.trim());
      if (fields.length === 0) throw new Error("Adicione pelo menos um campo");
      const { error } = await supabase.from("assessment_types").insert({
        clinic_id: clinicId, name: newTypeName.trim(), fields: fields as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-types", clinicId] });
      setNewAssessmentTypeDialog(false);
      setNewTypeName("");
      setNewTypeFields([""]);
      toast.success("Tipo de avaliação criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Save new assessment
  const saveAssessmentMutation = useMutation({
    mutationFn: async () => {
      if (!newAssessmentTypeId) throw new Error("Selecione um tipo de avaliação");
      if (!profile) throw new Error("Não autenticado");
      const { error } = await supabase.from("assessments").insert({
        record_id: recordId, clinic_id: clinicId, assessment_type_id: newAssessmentTypeId,
        professional_id: profile.id, data: newAssessmentData as any,
      });
      if (error) throw error;
      await supabase.from("record_audit_log").insert({
        record_id: recordId, clinic_id: clinicId, user_id: profile.id, user_name: profile.full_name,
        tab: "Avaliações", action: "CRIAÇÃO",
        summary: `Avaliação "${assessmentTypes.find((t: any) => t.id === newAssessmentTypeId)?.name}" criada`,
        details: newAssessmentData as any,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments", recordId] });
      queryClient.invalidateQueries({ queryKey: ["audit-log", recordId] });
      setShowNewAssessment(false);
      setNewAssessmentData({});
      setNewAssessmentTypeId("");
      toast.success("Avaliação salva!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!record) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  const statusMap: Record<string, { label: string; color: string }> = {
    agendado: { label: "Agendado", color: "bg-blue-100 text-blue-800" },
    confirmado: { label: "Confirmado", color: "bg-emerald-100 text-emerald-800" },
    compareceu: { label: "Compareceu", color: "bg-green-100 text-green-800" },
    faltou: { label: "Faltou", color: "bg-red-100 text-red-800" },
    cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
    remarcado: { label: "Remarcado", color: "bg-amber-100 text-amber-800" },
  };

  const FootSection = ({ assessment, label }: { assessment: any; label: string }) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Footprints className="w-4 h-4 text-primary" /> {label}
        {assessment.pain_level !== null && (
          <Badge variant={assessment.pain_level > 5 ? "destructive" : "secondary"}>
            Dor: {assessment.pain_level}/10
          </Badge>
        )}
      </h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {assessment.nail_condition && <div><p className="text-xs text-muted-foreground">Unhas</p><p>{assessment.nail_condition}</p></div>}
        {assessment.skin_condition && <div><p className="text-xs text-muted-foreground">Pele</p><p>{assessment.skin_condition}</p></div>}
        {assessment.deformities && <div><p className="text-xs text-muted-foreground">Deformidades</p><p>{assessment.deformities}</p></div>}
        {assessment.sensitivity && <div><p className="text-xs text-muted-foreground">Sensibilidade</p><p>{assessment.sensitivity}</p></div>}
        {assessment.circulation && <div><p className="text-xs text-muted-foreground">Circulação</p><p>{assessment.circulation}</p></div>}
        {assessment.observations && <div className="col-span-2"><p className="text-xs text-muted-foreground">Observações</p><p>{assessment.observations}</p></div>}
      </div>
    </div>
  );

  // Filter assessments
  const filteredAssessments = genericAssessments.filter((a: any) => {
    if (selectedAssessmentType !== "all" && a.assessment_type_id !== selectedAssessmentType) return false;
    if (assessmentSearch) {
      const typeName = (a.assessment_types?.name || "").toLowerCase();
      return typeName.includes(assessmentSearch.toLowerCase());
    }
    return true;
  });

  const selectedType = assessmentTypes.find((t: any) => t.id === newAssessmentTypeId);
  const selectedTypeFields: string[] = selectedType ? (selectedType.fields as any) : [];

  return (
    <div className="space-y-6">
      {/* Header - NO edit button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Prontuário — {record.clients?.name}
          </h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(record.date), "dd/MM/yyyy", { locale: ptBR })}</span>
            {record.profiles?.full_name && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{record.profiles.full_name}</span>}
          </div>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6">
          <Tabs defaultValue="clinical">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="clinical">Ficha Clínica</TabsTrigger>
              <TabsTrigger value="assessments">Avaliações</TabsTrigger>
              <TabsTrigger value="procedures">Procedimentos</TabsTrigger>
              <TabsTrigger value="documents">Documentos ({docs.length + legacyPhotos.length})</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            {/* ===== FICHA CLÍNICA (editable) ===== */}
            <TabsContent value="clinical" className="space-y-4 mt-4">
              {clinicalForm && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Dados clínicos do paciente</p>
                    {!clinicalEditing ? (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setClinicalEditing(true)}>
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setClinicalEditing(false); setClinicalForm({ chief_complaint: record.chief_complaint || "", clinical_notes: record.clinical_notes || "", diagnosis: record.diagnosis || "", treatment_performed: record.treatment_performed || "", recommendations: record.recommendations || "" }); }}>Cancelar</Button>
                        <Button size="sm" className="gap-1.5 bg-gradient-primary" onClick={() => saveClinicalMutation.mutate()} disabled={saveClinicalMutation.isPending}>
                          <Save className="w-3.5 h-3.5" /> {saveClinicalMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                      </div>
                    )}
                  </div>
                  {[
                    { key: "chief_complaint", label: "Queixa Principal" },
                    { key: "clinical_notes", label: "Anotações Clínicas" },
                    { key: "diagnosis", label: "Diagnóstico" },
                    { key: "treatment_performed", label: "Tratamento Realizado" },
                    { key: "recommendations", label: "Recomendações" },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                      {clinicalEditing ? (
                        <Textarea
                          rows={2}
                          value={clinicalForm[key]}
                          onChange={(e) => setClinicalForm({ ...clinicalForm, [key]: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{clinicalForm[key] || <span className="text-muted-foreground italic">Não informado</span>}</p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </TabsContent>

            {/* ===== AVALIAÇÕES ===== */}
            <TabsContent value="assessments" className="space-y-4 mt-4">
              {/* Foot assessments (legacy) */}
              {footAssessments.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Avaliação Podológica</p>
                  {footAssessments.map((a: any) => (
                    <div key={a.id}><FootSection assessment={a} label={a.foot === "left" ? "Pé Esquerdo" : "Pé Direito"} /><Separator className="mt-4" /></div>
                  ))}
                </div>
              )}

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                <div className="flex gap-2 flex-1">
                  <div className="relative flex-1 sm:max-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="Buscar avaliação..." className="pl-8 h-8 text-sm" value={assessmentSearch} onChange={(e) => setAssessmentSearch(e.target.value)} />
                  </div>
                  <Select value={selectedAssessmentType} onValueChange={setSelectedAssessmentType}>
                    <SelectTrigger className="w-[180px] h-8 text-sm">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {assessmentTypes.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setNewAssessmentTypeDialog(true)}>
                    <PlusCircle className="w-3.5 h-3.5" /> Novo Tipo
                  </Button>
                  <Button size="sm" className="gap-1.5 text-xs bg-gradient-primary" onClick={() => { setShowNewAssessment(true); setNewAssessmentData({}); setNewAssessmentTypeId(""); }}>
                    <Plus className="w-3.5 h-3.5" /> Nova Avaliação
                  </Button>
                </div>
              </div>

              {/* New assessment form */}
              {showNewAssessment && (
                <Card className="border-primary/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Nova Avaliação</h4>
                      <Button size="sm" variant="ghost" onClick={() => setShowNewAssessment(false)}><X className="w-4 h-4" /></Button>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tipo de Avaliação</Label>
                      <Select value={newAssessmentTypeId} onValueChange={(v) => { setNewAssessmentTypeId(v); setNewAssessmentData({}); }}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                        <SelectContent>
                          {assessmentTypes.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedTypeFields.map((field: string) => (
                      <div key={field} className="space-y-1">
                        <Label className="text-xs">{field}</Label>
                        <Textarea rows={2} value={newAssessmentData[field] || ""} onChange={(e) => setNewAssessmentData({ ...newAssessmentData, [field]: e.target.value })} />
                      </div>
                    ))}
                    {newAssessmentTypeId && (
                      <div className="flex justify-end">
                        <Button size="sm" className="gap-1.5 bg-gradient-primary" onClick={() => saveAssessmentMutation.mutate()} disabled={saveAssessmentMutation.isPending}>
                          <Save className="w-3.5 h-3.5" /> {saveAssessmentMutation.isPending ? "Salvando..." : "Salvar Avaliação"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Saved assessments (read-only) */}
              {filteredAssessments.length === 0 && !showNewAssessment && footAssessments.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma avaliação registrada.</p>
              )}
              {filteredAssessments.map((a: any) => (
                <Card key={a.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">{a.assessment_types?.name || "Avaliação"}</Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(a.data as Record<string, string>).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-xs text-muted-foreground">{key}</p>
                          <p className="text-sm">{value || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* New Assessment Type Dialog */}
              <Dialog open={newAssessmentTypeDialog} onOpenChange={setNewAssessmentTypeDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Tipo de Avaliação</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome do Tipo</Label>
                      <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="Ex: Avaliação Biomecânica" />
                    </div>
                    <div className="space-y-2">
                      <Label>Campos do Formulário</Label>
                      {newTypeFields.map((field, i) => (
                        <div key={i} className="flex gap-2">
                          <Input value={field} onChange={(e) => { const u = [...newTypeFields]; u[i] = e.target.value; setNewTypeFields(u); }} placeholder={`Campo ${i + 1}`} />
                          {newTypeFields.length > 1 && (
                            <Button size="icon" variant="ghost" onClick={() => setNewTypeFields(newTypeFields.filter((_, idx) => idx !== i))}>
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => setNewTypeFields([...newTypeFields, ""])}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Campo
                      </Button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setNewAssessmentTypeDialog(false)}>Cancelar</Button>
                      <Button className="bg-gradient-primary" onClick={() => saveAssessmentTypeMutation.mutate()} disabled={saveAssessmentTypeMutation.isPending}>
                        {saveAssessmentTypeMutation.isPending ? "Salvando..." : "Salvar Tipo"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* ===== PROCEDIMENTOS ===== */}
            <TabsContent value="procedures" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground mb-2">Histórico de eventos/agendamentos do paciente</p>
              {eventList.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum evento registrado para este paciente.</p>
              ) : (
                <div className="space-y-2">
                  {eventList.map((evt) => {
                    const st = statusMap[evt.status] || { label: evt.status, color: "bg-muted text-muted-foreground" };
                    const isExpanded = expandedEvent === evt.key;
                    const mainProc = evt.appointments[0];
                    // Get prescriptions for this event
                    const evtPrescriptions = savedPrescriptions.filter((p: any) =>
                      evt.appointments.some((a: any) => a.id === p.appointment_id)
                    );

                    return (
                      <Card key={evt.key} className={`border ${evt.status === 'cancelado' ? 'opacity-60' : ''}`}>
                        <CardContent className="p-0">
                          <button
                            className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                            onClick={() => { setExpandedEvent(isExpanded ? null : evt.key); setPrescriptionForAppt(null); setPrescriptionSaved(false); setSafetyResult(null); }}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {evt.googleEventId && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono" title={evt.googleEventId}>
                                    GCal: {evt.googleEventId.slice(0, 10)}…
                                  </Badge>
                                )}
                                <span className="text-sm font-medium">{format(new Date(evt.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                                <span className="text-xs text-muted-foreground">{evt.time.slice(0, 5)}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                                {evt.status === 'cancelado' && <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {evt.appointments.map((a: any) => a.procedures?.name || 'Procedimento').join(' + ')}
                                {evt.productTransactions.length > 0 && ` + ${evt.productTransactions.length} produto(s)`}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-primary whitespace-nowrap">R$ {evt.totalValue.toFixed(2)}</span>
                          </button>

                          {isExpanded && (
                            <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <ClipboardList className="w-3.5 h-3.5" /> Procedimentos
                                </p>
                                {evt.appointments.map((appt: any) => (
                                  <div key={appt.id} className="flex items-center justify-between py-1.5 text-sm border-b border-border/30 last:border-0">
                                    <div className="flex items-center gap-2">
                                      <span>{appt.procedures?.name || 'Procedimento'}</span>
                                      {appt.notes?.includes('adicional') && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Extra</Badge>}
                                    </div>
                                    <span className="text-xs font-medium">R$ {(Number(appt.estimated_price) || Number(appt.procedures?.price) || 0).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Materials */}
                              {(() => {
                                const evtApptIds = evt.appointments.map((a: any) => a.id);
                                const evtMaterials = appointmentMaterials.filter((m: any) => evtApptIds.includes(m.appointment_id));
                                if (evtMaterials.length === 0) return null;
                                return (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                      <Package className="w-3.5 h-3.5" /> Materiais Utilizados
                                    </p>
                                    {evtMaterials.map((mat: any) => (
                                      <div key={mat.id} className="flex items-center justify-between py-1 text-sm border-b border-border/30 last:border-0">
                                        <span>{mat.name}</span>
                                        <span className="text-xs text-muted-foreground">{mat.quantity} {mat.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}

                              {/* Products */}
                              {evt.productTransactions.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                    <Package className="w-3.5 h-3.5" /> Produtos Vendidos
                                  </p>
                                  {evt.productTransactions.map((tx: any) => (
                                    <div key={tx.id} className="flex items-center justify-between py-1.5 text-sm border-b border-border/30 last:border-0">
                                      <span>{tx.description}</span>
                                      <span className="text-xs font-medium">R$ {Number(tx.amount).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Attached docs */}
                              {(() => {
                                const evtDocs = docs.filter((d: any) => format(new Date(d.created_at), "yyyy-MM-dd") === evt.date);
                                if (evtDocs.length === 0) return null;
                                return (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                      <FileText className="w-3.5 h-3.5" /> Documentos Anexos
                                    </p>
                                    {evtDocs.map((doc: any) => (
                                      <div key={doc.id} className="flex items-center justify-between py-1.5 text-sm border-b border-border/30 last:border-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {editingTitleId === doc.id ? (
                                            <div className="flex gap-1.5 items-center">
                                              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-7 text-xs w-40" autoFocus />
                                              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => updateTitleMutation.mutate({ id: doc.id, title: editTitle })}>OK</Button>
                                              <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => setEditingTitleId(null)}><X className="w-3 h-3" /></Button>
                                            </div>
                                          ) : (
                                            <span className="truncate cursor-pointer hover:text-primary" onClick={() => { setEditingTitleId(doc.id); setEditTitle(doc.title); }}>
                                              {doc.title} <Edit className="w-3 h-3 inline text-muted-foreground" />
                                            </span>
                                          )}
                                        </div>
                                        <a href={doc.file_url} download={doc.title} target="_blank" rel="noopener noreferrer">
                                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs">
                                            <Download className="w-3.5 h-3.5" /> Baixar
                                          </Button>
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}

                              {mainProc.notes && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                                  <p className="text-xs text-muted-foreground">{mainProc.notes}</p>
                                </div>
                              )}

                              {/* Saved prescriptions for this event (read-only) */}
                              {evtPrescriptions.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <ScrollText className="w-3.5 h-3.5" /> Receituários Salvos
                                  </p>
                                  {evtPrescriptions.map((rx: any) => (
                                    <Card key={rx.id} className="border bg-muted/20">
                                      <CardContent className="p-3 text-sm space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium">{rx.professional_name} — {format(new Date(rx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                                          {rx.ai_safety_check && (
                                            <Badge variant="destructive" className="text-[10px]">
                                              <AlertTriangle className="w-3 h-3 mr-1" /> Alerta IA
                                            </Badge>
                                          )}
                                        </div>
                                        {rx.prescription && <div><span className="text-xs text-muted-foreground">Prescrição:</span> <span className="whitespace-pre-wrap">{rx.prescription}</span></div>}
                                        {rx.orientations && <div><span className="text-xs text-muted-foreground">Orientações:</span> <span className="whitespace-pre-wrap">{rx.orientations}</span></div>}
                                        {rx.observations && <div><span className="text-xs text-muted-foreground">Observações:</span> <span className="whitespace-pre-wrap">{rx.observations}</span></div>}
                                        {rx.ai_safety_check && <p className="text-xs text-destructive mt-1">{rx.ai_safety_check}</p>}
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}

                              {/* Inline Prescription Form */}
                              {prescriptionForAppt === mainProc.id && (
                                <div className="border rounded-lg p-4 bg-background space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                      <ScrollText className="w-4 h-4 text-primary" /> Receituário
                                    </h4>
                                    <Button size="sm" variant="ghost" onClick={() => { setPrescriptionForAppt(null); setPrescriptionSaved(false); setSafetyResult(null); }}>
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <span>Paciente: {record?.clients?.name}</span>
                                    <span>Data: {format(new Date(evt.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                                    <span>Profissional: {profile?.full_name || "—"}</span>
                                    <span>Procedimento: {mainProc.procedures?.name || "—"}</span>
                                  </div>

                                  {/* Safety warnings */}
                                  {safetyResult && safetyResult.warnings.length > 0 && (
                                    <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 space-y-1">
                                      <div className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                                        <AlertTriangle className="w-4 h-4" /> Alertas de Segurança (IA)
                                      </div>
                                      {safetyResult.warnings.map((w, i) => (
                                        <p key={i} className="text-xs text-destructive/80">• {w}</p>
                                      ))}
                                    </div>
                                  )}
                                  {safetyResult && safetyResult.safe && safetyResult.warnings.length === 0 && (
                                    <div className="p-2 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-1.5">
                                      <CheckCircle className="w-4 h-4 text-primary" />
                                      <span className="text-xs text-primary">Nenhuma contraindicação identificada pela IA.</span>
                                    </div>
                                  )}

                                  <div className="space-y-2">
                                    <Label className="text-xs">Prescrição</Label>
                                    <Textarea rows={3} value={prescriptionData.prescription} onChange={(e) => setPrescriptionData({ ...prescriptionData, prescription: e.target.value })} placeholder="1. Medicamento / posologia..." disabled={prescriptionSaved} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Orientações ao Paciente</Label>
                                    <Textarea rows={3} value={prescriptionData.orientations} onChange={(e) => setPrescriptionData({ ...prescriptionData, orientations: e.target.value })} placeholder="Cuidados, repouso, retorno..." disabled={prescriptionSaved} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Observações</Label>
                                    <Textarea rows={2} value={prescriptionData.observations} onChange={(e) => setPrescriptionData({ ...prescriptionData, observations: e.target.value })} disabled={prescriptionSaved} />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => printPrescription(mainProc)} disabled={!prescriptionSaved}>
                                      <Printer className="w-3.5 h-3.5" /> Imprimir
                                    </Button>
                                    {!prescriptionSaved && (
                                      <Button size="sm" className="gap-1.5 bg-gradient-primary" onClick={() => savePrescription(mainProc)} disabled={savingPrescription}>
                                        {savingPrescription ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando...</> : <><Save className="w-3.5 h-3.5" /> Salvar</>}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex gap-2 pt-1">
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file'; input.accept = 'image/*,application/pdf'; input.multiple = true;
                                    input.onchange = async (ev) => {
                                      const files = (ev.target as HTMLInputElement).files;
                                      if (files) { try { await handleUploadForProcedure(files, mainProc.id); } catch { toast.error("Erro ao anexar documento"); } }
                                    };
                                    input.click();
                                  }}
                                >
                                  <FileUp className="w-3.5 h-3.5" /> Anexar Documento
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                                  onClick={() => { setPrescriptionForAppt(mainProc.id); setPrescriptionData({ prescription: "", orientations: "", observations: "" }); setPrescriptionSaved(false); setSafetyResult(null); }}
                                >
                                  <ScrollText className="w-3.5 h-3.5" /> Gerar Receita
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ===== DOCUMENTOS ===== */}
            <TabsContent value="documents" className="space-y-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Documentos e imagens anexados</p>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Adicionar
                </Button>
              </div>

              {docs.length === 0 && legacyPhotos.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
                  <Button variant="link" className="mt-2" onClick={() => fileInputRef.current?.click()}>Anexar primeiro documento</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {docs.map((doc: any) => (
                    <Card key={doc.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {doc.file_type === "image" ? (
                            <img src={doc.file_url} alt={doc.title} className="w-20 h-20 object-cover rounded-lg border shrink-0" />
                          ) : (
                            <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center shrink-0">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {editingTitleId === doc.id ? (
                              <div className="flex gap-2">
                                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 text-sm" autoFocus />
                                <Button size="sm" variant="outline" onClick={() => updateTitleMutation.mutate({ id: doc.id, title: editTitle })}>Salvar</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingTitleId(null)}><X className="w-4 h-4" /></Button>
                              </div>
                            ) : (
                              <p className="font-medium text-sm cursor-pointer hover:text-primary" onClick={() => { setEditingTitleId(doc.id); setEditTitle(doc.title); }}>
                                {doc.title} <Edit className="w-3 h-3 inline ml-1 text-muted-foreground" />
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              {doc.file_type === "image" ? " · Imagem" : " · Documento"}
                            </p>
                            {doc.ai_analysis && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-xs font-medium text-primary">Análise por IA</span>
                                  {doc.ai_analyzed_at && <span className="text-xs text-muted-foreground ml-auto">{format(new Date(doc.ai_analyzed_at), "dd/MM HH:mm")}</span>}
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{doc.ai_analysis}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <a href={doc.file_url} download={doc.title} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs w-full">
                                <Download className="w-3.5 h-3.5" /> Baixar
                              </Button>
                            </a>
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={analyzingId === doc.id} onClick={() => analyzeDocMutation.mutate(doc)}>
                              {analyzingId === doc.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</> : <><Brain className="w-3.5 h-3.5" /> Analisar com IA</>}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => deleteDocMutation.mutate(doc.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {legacyPhotos.length > 0 && (
                    <>
                      {docs.length > 0 && <Separator />}
                      <p className="text-xs text-muted-foreground">Fotos anteriores</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {legacyPhotos.map((p: any) => (
                          <div key={p.id} className="space-y-1">
                            <img src={p.photo_url} alt={p.description || ""} className="w-full h-40 object-cover rounded-lg border" />
                            {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ===== HISTÓRICO ===== */}
            <TabsContent value="history" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">Registro de todas as alterações no prontuário</p>
              {auditLog.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum registro de alteração.</p>
              ) : (
                <div className="space-y-2">
                  {auditLog.map((log: any) => (
                    <Card key={log.id} className="border cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setAuditDetailId(auditDetailId === log.id ? null : log.id)}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{log.summary}</span>
                            <Badge variant="secondary" className="text-[10px]">{log.tab}</Badge>
                            <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">por {log.user_name}</p>

                        {auditDetailId === log.id && log.details && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
        onChange={(e) => { if (e.target.files) uploadDocMutation.mutate(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

export default ProntuariosModule;
