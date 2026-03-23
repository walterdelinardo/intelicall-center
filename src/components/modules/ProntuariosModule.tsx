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
  Package, XCircle, Download, Printer, Save
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

  // Handle external navigation with pre-selected client
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

  // Deduplicate: show only 1 record per patient (the most recent one)
  const uniqueByClient = records.reduce((acc: any[], rec: any) => {
    if (!acc.find((r: any) => r.client_id === rec.client_id)) {
      acc.push(rec);
    }
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

  // Inline form/view
  if (viewMode === "create" || viewMode === "edit") {
    return (
      <RecordFormInline
        clinicId={profile?.clinic_id || ""}
        userId={profile?.id || ""}
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
        onEdit={() => goToEdit(activeRecordId)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header stats */}
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

      {/* Toolbar */}
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

      {/* Records table - 1 per patient */}
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

      {/* Delete confirmation */}
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
function RecordFormInline({ clinicId, userId, clients, editRecordId, onBack }: {
  clinicId: string; userId: string; clients: any[];
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
        // Check if patient already has a record
        const { data: existing } = await supabase
          .from("medical_records")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("client_id", form.client_id)
          .maybeSingle();
        
        if (existing) {
          // Update existing record instead of creating a new one
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

      // Foot assessments
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

      // Upload new documents
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
              <TabsTrigger value="feet">Avaliação Pés</TabsTrigger>
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
                            onChange={(e) => {
                              const u = [...documents]; u[i].title = e.target.value; setDocuments(u);
                            }}
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
function ViewRecordInline({ recordId, clinicId, onBack, onEdit }: {
  recordId: string; clinicId: string; onBack: () => void; onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [prescriptionForAppt, setPrescriptionForAppt] = useState<string | null>(null);
  const [prescriptionData, setPrescriptionData] = useState({ prescription: "", orientations: "", observations: "" });

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

  const { data: assessments = [] } = useQuery({
    queryKey: ["foot-assessments", recordId],
    queryFn: async () => {
      const { data, error } = await supabase.from("foot_assessments").select("*").eq("record_id", recordId);
      if (error) throw error;
      return data;
    },
    enabled: !!recordId,
  });

  // Patient procedures (from appointments) - include cancelled
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

  // Financial transactions for this patient
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

  // Group appointments by event using parent_appointment_id (or own id if no parent)
  const groupedEvents = procedures.reduce((acc: Record<string, any[]>, appt: any) => {
    const key = appt.parent_appointment_id || appt.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(appt);
    return acc;
  }, {} as Record<string, any[]>);

  const eventList = Object.entries(groupedEvents).map(([eventId, appts]: [string, any[]]) => {
    // The main appointment is the one without a parent (or the first one sorted by seq_number)
    const mainAppt = appts.find((a: any) => !a.parent_appointment_id) || appts.reduce((min: any, a: any) => a.seq_number < min.seq_number ? a : min, appts[0]);
    const date = mainAppt.date;
    const time = mainAppt.start_time;
    const seqNumber = mainAppt.seq_number;

    // Determine overall event status
    const statuses = appts.map((a: any) => a.status);
    let eventStatus = statuses[0];
    if (statuses.includes('cancelado') && statuses.every((s: string) => s === 'cancelado')) {
      eventStatus = 'cancelado';
    } else if (statuses.includes('compareceu')) {
      eventStatus = 'compareceu';
    }
    
    const totalValue = appts.reduce((sum: number, a: any) => sum + (Number(a.estimated_price) || Number(a.procedures?.price) || 0), 0);
    // Get related product transactions for this event
    const eventTransactions = transactions.filter((tx: any) => 
      appts.some((a: any) => a.id === tx.appointment_id) && tx.category === 'produto'
    );
    const productTotal = eventTransactions.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
    
    return {
      key: eventId,
      date,
      time,
      seqNumber,
      googleEventId: mainAppt.google_event_id,
      status: eventStatus,
      appointments: appts,
      totalValue: totalValue + productTotal,
      productTransactions: eventTransactions,
    };
  }).sort((a, b) => b.seqNumber - a.seqNumber);

  // Documents from record_documents
  const { data: docs = [] } = useQuery({
    queryKey: ["record-documents", recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("record_documents")
        .select("*")
        .eq("record_id", recordId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!recordId,
  });

  // Also load legacy photos
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
    onError: (e: any) => {
      toast.error(e.message || "Erro na análise");
      setAnalyzingId(null);
    },
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

  const generatePrescription = (procedure?: any) => {
    if (!record) return;
    const procedureName = procedure?.procedures?.name || "—";
    const procedureDate = procedure ? format(new Date(procedure.date), "dd/MM/yyyy", { locale: ptBR }) : format(new Date(record.date), "dd/MM/yyyy", { locale: ptBR });
    const lines = [
      `RECEITUÁRIO`,
      ``,
      `Paciente: ${record.clients?.name || "—"}`,
      `Data: ${procedureDate}`,
      `Profissional: ${record.profiles?.full_name || "—"}`,
      ``,
      `Procedimento Realizado: ${procedureName}`,
      ``,
      `─────────────────────────────────────────`,
      `PRESCRIÇÃO:`,
      ``,
      `1. `,
      ``,
      `2. `,
      ``,
      `3. `,
      ``,
      `─────────────────────────────────────────`,
      `ORIENTAÇÕES AO PACIENTE:`,
      ``,
      `• `,
      ``,
      `• `,
      ``,
      `─────────────────────────────────────────`,
      `OBSERVAÇÕES:`,
      ``,
      ``,
      ``,
      ``,
      `_________________________________`,
      `Assinatura do Profissional`,
      `${record.profiles?.full_name || ""}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Receita_${record.clients?.name || "paciente"}_${procedureDate.replace(/\//g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Receita gerada!");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        <Button size="sm" className="gap-2" onClick={onEdit}>
          <Edit className="w-4 h-4" /> Editar
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6">
          <Tabs defaultValue="clinical">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="clinical">Ficha Clínica</TabsTrigger>
              <TabsTrigger value="feet">Avaliação Pés</TabsTrigger>
              <TabsTrigger value="procedures">Procedimentos</TabsTrigger>
              <TabsTrigger value="documents">Documentos ({docs.length + legacyPhotos.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="clinical" className="space-y-4 mt-4">
              {record.chief_complaint && <div><p className="text-xs font-medium text-muted-foreground mb-1">Queixa Principal</p><p className="text-sm">{record.chief_complaint}</p></div>}
              {record.clinical_notes && <div><p className="text-xs font-medium text-muted-foreground mb-1">Anotações Clínicas</p><p className="text-sm whitespace-pre-wrap">{record.clinical_notes}</p></div>}
              {record.diagnosis && <div><p className="text-xs font-medium text-muted-foreground mb-1">Diagnóstico</p><p className="text-sm">{record.diagnosis}</p></div>}
              {record.treatment_performed && <div><p className="text-xs font-medium text-muted-foreground mb-1">Tratamento Realizado</p><p className="text-sm whitespace-pre-wrap">{record.treatment_performed}</p></div>}
              {record.recommendations && <div><p className="text-xs font-medium text-muted-foreground mb-1">Recomendações</p><p className="text-sm whitespace-pre-wrap">{record.recommendations}</p></div>}
              {!record.chief_complaint && !record.clinical_notes && !record.diagnosis && !record.treatment_performed && !record.recommendations && (
                <p className="text-muted-foreground text-sm">Nenhuma informação clínica registrada.</p>
              )}
            </TabsContent>

            <TabsContent value="feet" className="space-y-4 mt-4">
              {assessments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma avaliação podológica registrada.</p>
              ) : assessments.map((a: any) => (
                <div key={a.id}><FootSection assessment={a} label={a.foot === "left" ? "Pé Esquerdo" : "Pé Direito"} /><Separator className="mt-4" /></div>
              ))}
            </TabsContent>

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
                    
                    return (
                      <Card key={evt.key} className={`border ${evt.status === 'cancelado' ? 'opacity-60' : ''}`}>
                        <CardContent className="p-0">
                          {/* Event header row */}
                          <button
                            className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                            onClick={() => setExpandedEvent(isExpanded ? null : evt.key)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {evt.googleEventId && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono" title={evt.googleEventId}>
                                    GCal: {evt.googleEventId.slice(0, 10)}…
                                  </Badge>
                                )}
                                <span className="text-sm font-medium">
                                  {format(new Date(evt.date), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                                <span className="text-xs text-muted-foreground">{evt.time.slice(0, 5)}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                                  {st.label}
                                </span>
                                {evt.status === 'cancelado' && (
                                  <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {evt.appointments.map((a: any) => a.procedures?.name || 'Procedimento').join(' + ')}
                                {evt.productTransactions.length > 0 && ` + ${evt.productTransactions.length} produto(s)`}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-primary whitespace-nowrap">
                              R$ {evt.totalValue.toFixed(2)}
                            </span>
                          </button>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
                              {/* Procedures */}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <ClipboardList className="w-3.5 h-3.5" /> Procedimentos
                                </p>
                                {evt.appointments.map((appt: any) => (
                                  <div key={appt.id} className="flex items-center justify-between py-1.5 text-sm border-b border-border/30 last:border-0">
                                    <div className="flex items-center gap-2">
                                      <span>{appt.procedures?.name || 'Procedimento'}</span>
                                      {appt.notes?.includes('adicional') && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Extra</Badge>
                                      )}
                                    </div>
                                    <span className="text-xs font-medium">
                                      R$ {(Number(appt.estimated_price) || Number(appt.procedures?.price) || 0).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>

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

                              {/* Notes */}
                              {mainProc.notes && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                                  <p className="text-xs text-muted-foreground">{mainProc.notes}</p>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex gap-2 pt-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*,application/pdf';
                                    input.multiple = true;
                                    input.onchange = async (ev) => {
                                      const files = (ev.target as HTMLInputElement).files;
                                      if (files) {
                                        try {
                                          await handleUploadForProcedure(files, mainProc.id);
                                        } catch {
                                          toast.error("Erro ao anexar documento");
                                        }
                                      }
                                    };
                                    input.click();
                                  }}
                                >
                                  <FileUp className="w-3.5 h-3.5" /> Anexar Documento
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={() => generatePrescription(mainProc)}
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
                  {/* New documents */}
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
                                <Button size="sm" variant="outline" onClick={() => updateTitleMutation.mutate({ id: doc.id, title: editTitle })}>
                                  Salvar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingTitleId(null)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <p className="font-medium text-sm cursor-pointer hover:text-primary" onClick={() => { setEditingTitleId(doc.id); setEditTitle(doc.title); }}>
                                {doc.title}
                                <Edit className="w-3 h-3 inline ml-1 text-muted-foreground" />
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              {doc.file_type === "image" ? " · Imagem" : " · Documento"}
                            </p>

                            {/* AI Analysis */}
                            {doc.ai_analysis && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-xs font-medium text-primary">Análise por IA</span>
                                  {doc.ai_analyzed_at && (
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {format(new Date(doc.ai_analyzed_at), "dd/MM HH:mm")}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{doc.ai_analysis}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button
                              size="sm" variant="outline" className="gap-1.5 text-xs"
                              disabled={analyzingId === doc.id}
                              onClick={() => analyzeDocMutation.mutate(doc)}
                            >
                              {analyzingId === doc.id ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
                              ) : (
                                <><Brain className="w-3.5 h-3.5" /> Analisar com IA</>
                              )}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => deleteDocMutation.mutate(doc.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Legacy photos */}
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProntuariosModule;
