import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardList, Plus, Edit, Trash2, ArrowLeft, Search, X, Package } from "lucide-react";
import { toast } from "sonner";

interface Procedure {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

interface ProcedureMaterial {
  id: string;
  stock_item_id: string;
  quantity: number;
  stock_item?: { name: string; unit: string | null };
}

type ViewMode = "list" | "form";

const ProcedimentosModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", duration_minutes: "30", price: "0" });
  const [materials, setMaterials] = useState<{ stock_item_id: string; name: string; unit: string; quantity: string }[]>([]);
  const [materialSearchOpen, setMaterialSearchOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");

  const resetForm = () => {
    setForm({ name: "", description: "", duration_minutes: "30", price: "0" });
    setMaterials([]);
    setEditingId(null);
  };

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ["procedures", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("procedures")
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("name");
      if (error) throw error;
      return data as Procedure[];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock-items-list", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, unit, quantity")
        .eq("clinic_id", profile.clinic_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: existingMaterials = [] } = useQuery({
    queryKey: ["procedure-materials", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data, error } = await supabase
        .from("procedure_materials")
        .select("id, stock_item_id, quantity")
        .eq("procedure_id", editingId);
      if (error) throw error;
      return data;
    },
    enabled: !!editingId,
  });

  const filteredStock = useMemo(() => {
    const q = materialSearch.toLowerCase();
    const usedIds = new Set(materials.map(m => m.stock_item_id));
    return stockItems
      .filter((s: any) => !usedIds.has(s.id) && (!q || s.name.toLowerCase().includes(q)))
      .slice(0, 15);
  }, [stockItems, materialSearch, materials]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      const payload = {
        clinic_id: profile.clinic_id,
        name: form.name,
        description: form.description || null,
        duration_minutes: parseInt(form.duration_minutes) || 30,
        price: parseFloat(form.price) || 0,
      };

      let procedureId: string;
      if (editingId) {
        const { error } = await supabase.from("procedures").update(payload).eq("id", editingId);
        if (error) throw error;
        procedureId = editingId;
        // Delete existing materials
        await supabase.from("procedure_materials").delete().eq("procedure_id", procedureId);
      } else {
        const { data, error } = await supabase.from("procedures").insert(payload).select("id").single();
        if (error) throw error;
        procedureId = data.id;
      }

      // Insert materials
      if (materials.length > 0) {
        const { error: matErr } = await supabase.from("procedure_materials").insert(
          materials.map(m => ({
            procedure_id: procedureId,
            stock_item_id: m.stock_item_id,
            quantity: parseFloat(m.quantity) || 1,
            clinic_id: profile.clinic_id!,
          }))
        );
        if (matErr) throw matErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      queryClient.invalidateQueries({ queryKey: ["procedure-materials"] });
      toast.success(editingId ? "Procedimento atualizado!" : "Procedimento cadastrado!");
      setViewMode("list");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("procedures").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["procedures"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("procedures").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      toast.success("Procedimento excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (p: Procedure) => {
    setForm({
      name: p.name,
      description: p.description || "",
      duration_minutes: String(p.duration_minutes),
      price: String(p.price),
    });
    setEditingId(p.id);
    setViewMode("form");
  };

  const openCreate = () => {
    resetForm();
    setViewMode("form");
  };

  // Load existing materials into state when editing
  const loadedMaterialsRef = useState<string | null>(null);
  if (editingId && existingMaterials.length > 0 && loadedMaterialsRef[0] !== editingId) {
    const mats = existingMaterials.map((m: any) => {
      const item = stockItems.find((s: any) => s.id === m.stock_item_id);
      return {
        stock_item_id: m.stock_item_id,
        name: item?.name || 'Item desconhecido',
        unit: item?.unit || 'un',
        quantity: String(m.quantity),
      };
    });
    setMaterials(mats);
    loadedMaterialsRef[1](editingId);
  }

  // ========= FORM VIEW =========
  if (viewMode === "form") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setViewMode("list"); resetForm(); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold">{editingId ? "Editar" : "Novo"} Procedimento</h2>
        </div>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Tratamento de unha encravada" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duração (min)</Label>
                  <Input type="number" min="5" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
              </div>

              {/* Materials Section */}
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Package className="w-4 h-4 text-primary" /> Materiais Utilizados
                </Label>
                {materials.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum material adicionado. Adicione itens do estoque usados neste procedimento.</p>
                )}
                {materials.map((mat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{mat.name}</span>
                    <Input
                      type="number"
                      min="0.1"
                      step="0.1"
                      className="w-20 h-8 text-xs"
                      value={mat.quantity}
                      onChange={(e) => {
                        const updated = [...materials];
                        updated[idx].quantity = e.target.value;
                        setMaterials(updated);
                      }}
                    />
                    <span className="text-xs text-muted-foreground w-8">{mat.unit}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMaterials(materials.filter((_, i) => i !== idx))}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Popover open={materialSearchOpen} onOpenChange={setMaterialSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-1 text-xs">
                      <Plus className="w-3 h-3" /> Adicionar Material
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Buscar item do estoque..." value={materialSearch} onValueChange={setMaterialSearch} />
                      <CommandList>
                        <CommandEmpty>Nenhum item encontrado</CommandEmpty>
                        <CommandGroup>
                          {filteredStock.map((s: any) => (
                            <CommandItem key={s.id} onSelect={() => {
                              setMaterials([...materials, { stock_item_id: s.id, name: s.name, unit: s.unit || 'un', quantity: '1' }]);
                              setMaterialSearch("");
                              setMaterialSearchOpen(false);
                            }}>
                              <span>{s.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">{s.unit || 'un'}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setViewMode("list"); resetForm(); }}>Cancelar</Button>
                <Button type="submit" className="bg-gradient-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========= LIST VIEW =========
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" /> Catálogo de Procedimentos
        </h2>
        <Button className="bg-gradient-primary gap-2 shadow-card" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo Procedimento
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : procedures.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum procedimento cadastrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">Duração</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procedures.map((p) => (
                  <TableRow key={p.id} className={!p.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{p.name}</span>
                        {p.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{p.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{p.duration_minutes} min</TableCell>
                    <TableCell>R$ {Number(p.price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, is_active: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          onClick={() => { if (confirm("Excluir este procedimento?")) deleteMutation.mutate(p.id); }}
                        >
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
    </div>
  );
};

export default ProcedimentosModule;
