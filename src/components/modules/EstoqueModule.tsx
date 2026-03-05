import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Package, Plus, Search, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["geral", "descartáveis", "instrumentos", "químicos", "higiene", "outros"];
const UNITS = ["un", "cx", "pct", "ml", "L", "g", "kg", "par"];

const emptyForm = { name: "", description: "", category: "geral", unit: "un", quantity: "0", min_quantity: "0", cost_price: "0", supplier: "" };

const EstoqueModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("stock_items")
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("name");
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
        description: form.description || null,
        category: form.category,
        unit: form.unit,
        quantity: parseFloat(form.quantity) || 0,
        min_quantity: parseFloat(form.min_quantity) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        supplier: form.supplier || null,
      };
      if (editId) {
        const { error } = await supabase.from("stock_items").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stock_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      toast.success(editId ? "Item atualizado!" : "Item adicionado!");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Item removido!");
    },
  });

  const openEdit = (item: any) => {
    setEditId(item.id);
    setForm({
      name: item.name, description: item.description || "", category: item.category || "geral",
      unit: item.unit || "un", quantity: String(item.quantity), min_quantity: String(item.min_quantity),
      cost_price: String(item.cost_price || 0), supplier: item.supplier || "",
    });
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const filtered = items.filter((i: any) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || "").toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = items.filter((i: any) => i.quantity <= i.min_quantity && i.min_quantity > 0);
  const totalValue = items.reduce((sum: number, i: any) => sum + (i.quantity * (i.cost_price || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total de Itens</p><p className="text-2xl font-bold text-foreground">{items.length}</p></CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Valor em Estoque</p><p className="text-2xl font-bold text-green-600">R$ {totalValue.toFixed(2)}</p></CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Estoque Baixo</p><p className={`text-2xl font-bold ${lowStock.length > 0 ? "text-red-600" : "text-foreground"}`}>{lowStock.length}</p></CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Categorias</p><p className="text-2xl font-bold text-foreground">{new Set(items.map((i: any) => i.category)).size}</p></CardContent></Card>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <Card className="border-red-300 bg-red-50 shadow-card">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Itens com estoque baixo:</p>
              <p className="text-sm text-red-700">{lowStock.map((i: any) => `${i.name} (${i.quantity} ${i.unit})`).join(", ")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar item..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={isOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setIsOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary gap-2 shadow-card"><Plus className="w-4 h-4" /> Novo Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar Item" : "Novo Item"}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Mínima</Label>
                  <Input type="number" min="0" step="0.01" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Custo (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
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

      {/* Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum item no estoque.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Custo Unit.</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                    <TableCell>{item.quantity} {item.unit}</TableCell>
                    <TableCell>R$ {Number(item.cost_price || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.supplier || "—"}</TableCell>
                    <TableCell>
                      {item.min_quantity > 0 && item.quantity <= item.min_quantity ? (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Baixo</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-green-300">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

export default EstoqueModule;
