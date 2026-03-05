import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileText, Plus, Search, Eye, Calendar, User, Footprints,
  Package, Camera, Trash2, Upload, X, Clock, Edit
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ProntuariosModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewRecordId, setViewRecordId] = useState<string | null>(null);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

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

  const filtered = records.filter((r) =>
    !search || (r.clients?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.chief_complaint || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total de Prontuários</p>
            <p className="text-2xl font-bold text-foreground">{records.length}</p>
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
            <p className="text-2xl font-bold text-success">
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
        <Button className="bg-gradient-primary gap-2 shadow-card" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4" /> Novo Prontuário
        </Button>
      </div>

      {/* Records table */}
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
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="hidden md:table-cell">Queixa Principal</TableHead>
                  <TableHead className="hidden lg:table-cell">Profissional</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(rec.date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{rec.clients?.name || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                      {rec.chief_complaint || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{rec.profiles?.full_name || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setViewRecordId(rec.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditRecordId(rec.id)}>
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

      {/* Create dialog */}
      <RecordFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        clients={clients}
        clinicId={profile?.clinic_id || ""}
        userId={profile?.id || ""}
      />

      {/* Edit dialog */}
      {editRecordId && (
        <RecordFormDialog
          open={!!editRecordId}
          onOpenChange={(o) => !o && setEditRecordId(null)}
          clients={clients}
          clinicId={profile?.clinic_id || ""}
          userId={profile?.id || ""}
          editRecordId={editRecordId}
        />
      )}

      {/* View dialog */}
      {viewRecordId && (
        <ViewRecordDialog
          recordId={viewRecordId}
          open={!!viewRecordId}
          onOpenChange={(o) => !o && setViewRecordId(null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteRecordId} onOpenChange={(o) => !o && setDeleteRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Prontuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este prontuário? Esta ação não pode ser desfeita. Todos os dados relacionados (avaliações, produtos e fotos) serão removidos.
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

// ===================== RECORD FORM DIALOG (CREATE + EDIT) =====================
function RecordFormDialog({ open, onOpenChange, clients, clinicId, userId, editRecordId }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  clients: any[]; clinicId: string; userId: string; editRecordId?: string;
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
  const [products, setProducts] = useState<{ product_name: string; quantity: string; notes: string }[]>([]);
  const [photos, setPhotos] = useState<{ file: File; description: string; photo_type: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load existing record for editing
  const { data: existingRecord } = useQuery({
    queryKey: ["medical-record-edit", editRecordId],
    queryFn: async () => {
      if (!editRecordId) return null;
      const [recRes, footRes, prodRes] = await Promise.all([
        supabase.from("medical_records").select("*").eq("id", editRecordId).single(),
        supabase.from("foot_assessments").select("*").eq("record_id", editRecordId),
        supabase.from("record_products").select("*").eq("record_id", editRecordId),
      ]);
      if (recRes.error) throw recRes.error;
      return { record: recRes.data, feet: footRes.data || [], products: prodRes.data || [] };
    },
    enabled: !!editRecordId,
  });

  // Populate form when editing
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
    setProducts(existingRecord.products.map((p: any) => ({ product_name: p.product_name, quantity: p.quantity || "", notes: p.notes || "" })));
    setLoaded(true);
  }

  const resetAll = () => {
    setForm({ client_id: "", date: format(new Date(), "yyyy-MM-dd"), chief_complaint: "", clinical_notes: "", diagnosis: "", treatment_performed: "", recommendations: "" });
    setLeftFoot({ ...emptyFoot });
    setRightFoot({ ...emptyFoot });
    setProducts([]);
    setPhotos([]);
    setTab("clinical");
    setLoaded(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId || !form.client_id) throw new Error("Selecione um paciente");

      const recordData = {
        clinic_id: clinicId,
        client_id: form.client_id,
        professional_id: userId,
        date: form.date,
        chief_complaint: form.chief_complaint || null,
        clinical_notes: form.clinical_notes || null,
        diagnosis: form.diagnosis || null,
        treatment_performed: form.treatment_performed || null,
        recommendations: form.recommendations || null,
      };

      let recordId: string;

      if (editRecordId) {
        const { error } = await supabase.from("medical_records").update(recordData).eq("id", editRecordId);
        if (error) throw error;
        recordId = editRecordId;

        // Replace foot assessments and products
        await supabase.from("foot_assessments").delete().eq("record_id", recordId);
        await supabase.from("record_products").delete().eq("record_id", recordId);
      } else {
        const { data: record, error } = await supabase.from("medical_records").insert(recordData).select("id").single();
        if (error) throw error;
        recordId = record.id;
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

      // Products
      if (products.length > 0) {
        const { error: prodErr } = await supabase.from("record_products").insert(
          products.map(p => ({ record_id: recordId, product_name: p.product_name, quantity: p.quantity || null, notes: p.notes || null }))
        );
        if (prodErr) throw prodErr;
      }

      // Photos (only new uploads)
      for (const photo of photos) {
        const filePath = `${clinicId}/${recordId}/${Date.now()}_${photo.file.name}`;
        const { error: upErr } = await supabase.storage.from("record-photos").upload(filePath, photo.file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("record-photos").getPublicUrl(filePath);
        await supabase.from("record_photos").insert({
          record_id: recordId, photo_url: urlData.publicUrl,
          description: photo.description || null, photo_type: photo.photo_type,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({ queryKey: ["medical-record"] });
      toast.success(editRecordId ? "Prontuário atualizado!" : "Prontuário salvo com sucesso!");
      onOpenChange(false);
      resetAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addProduct = () => setProducts([...products, { product_name: "", quantity: "", notes: "" }]);
  const removeProduct = (i: number) => setProducts(products.filter((_, idx) => idx !== i));
  const updateProduct = (i: number, field: string, value: string) => {
    const updated = [...products];
    (updated[i] as any)[field] = value;
    setProducts(updated);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files).map(file => ({ file, description: "", photo_type: "during" }));
      setPhotos([...photos, ...newPhotos]);
    }
  };
  const removePhoto = (i: number) => setPhotos(photos.filter((_, idx) => idx !== i));

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
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAll(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> {editRecordId ? "Editar Prontuário" : "Novo Prontuário"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="clinical">Ficha Clínica</TabsTrigger>
            <TabsTrigger value="feet">Avaliação Pés</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="photos">Fotos</TabsTrigger>
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

          <TabsContent value="products" className="space-y-4 mt-4">
            {products.map((p, i) => (
              <Card key={i} className="border">
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Produto {i + 1}</span>
                    <Button size="icon" variant="ghost" onClick={() => removeProduct(i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input placeholder="Nome do produto *" value={p.product_name} onChange={(e) => updateProduct(i, "product_name", e.target.value)} />
                    <Input placeholder="Quantidade" value={p.quantity} onChange={(e) => updateProduct(i, "quantity", e.target.value)} />
                    <Input placeholder="Observação" value={p.notes} onChange={(e) => updateProduct(i, "notes", e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" className="gap-2" onClick={addProduct}>
              <Package className="w-4 h-4" /> Adicionar Produto
            </Button>
          </TabsContent>

          <TabsContent value="photos" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="photo-upload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar fotos</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG — Antes, durante e depois</p>
                </div>
              </Label>
              <input id="photo-upload" type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((p, i) => (
                  <Card key={i} className="border overflow-hidden">
                    <div className="relative">
                      <img src={URL.createObjectURL(p.file)} alt="" className="w-full h-32 object-cover" />
                      <Button size="icon" variant="destructive" className="absolute top-1 right-1 w-6 h-6" onClick={() => removePhoto(i)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <CardContent className="p-2 space-y-1">
                      <Select value={p.photo_type} onValueChange={(v) => { const u = [...photos]; u[i].photo_type = v; setPhotos(u); }}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="before">Antes</SelectItem>
                          <SelectItem value="during">Durante</SelectItem>
                          <SelectItem value="after">Depois</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input className="h-7 text-xs" placeholder="Descrição" value={p.description} onChange={(e) => { const u = [...photos]; u[i].description = e.target.value; setPhotos(u); }} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => { resetAll(); onOpenChange(false); }}>Cancelar</Button>
          <Button className="bg-gradient-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.client_id}>
            {saveMutation.isPending ? "Salvando..." : editRecordId ? "Atualizar Prontuário" : "Salvar Prontuário"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== VIEW RECORD DIALOG =====================
function ViewRecordDialog({ recordId, open, onOpenChange }: {
  recordId: string; open: boolean; onOpenChange: (o: boolean) => void;
}) {
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

  const { data: products = [] } = useQuery({
    queryKey: ["record-products", recordId],
    queryFn: async () => {
      const { data, error } = await supabase.from("record_products").select("*").eq("record_id", recordId);
      if (error) throw error;
      return data;
    },
    enabled: !!recordId,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["record-photos", recordId],
    queryFn: async () => {
      const { data, error } = await supabase.from("record_photos").select("*").eq("record_id", recordId).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!recordId,
  });

  if (!record) return null;

  const photoTypeLabel: Record<string, string> = { before: "Antes", during: "Durante", after: "Depois" };

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Prontuário — {record.clients?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{format(new Date(record.date), "dd/MM/yyyy", { locale: ptBR })}</span>
          {record.profiles?.full_name && <span className="flex items-center gap-1"><User className="w-4 h-4" />{record.profiles.full_name}</span>}
        </div>

        <Tabs defaultValue="clinical">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="clinical">Ficha Clínica</TabsTrigger>
            <TabsTrigger value="feet">Avaliação Pés</TabsTrigger>
            <TabsTrigger value="products">Produtos ({products.length})</TabsTrigger>
            <TabsTrigger value="photos">Fotos ({photos.length})</TabsTrigger>
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

          <TabsContent value="products" className="mt-4">
            {products.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum produto registrado.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Quantidade</TableHead><TableHead>Observação</TableHead></TableRow></TableHeader>
                <TableBody>
                  {products.map((p: any) => (
                    <TableRow key={p.id}><TableCell className="font-medium">{p.product_name}</TableCell><TableCell>{p.quantity || "—"}</TableCell><TableCell>{p.notes || "—"}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="photos" className="mt-4">
            {photos.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma foto registrada.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((p: any) => (
                  <div key={p.id} className="space-y-1">
                    <img src={p.photo_url} alt={p.description || ""} className="w-full h-40 object-cover rounded-lg border" />
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">{photoTypeLabel[p.photo_type] || p.photo_type}</Badge>
                      {p.description && <span className="text-xs text-muted-foreground truncate">{p.description}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground pt-2">
          Criado em {format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default ProntuariosModule;
