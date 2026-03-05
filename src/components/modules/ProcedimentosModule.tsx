import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ClipboardList, Plus, Edit, Trash2 } from "lucide-react";
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

const ProcedimentosModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", duration_minutes: "30", price: "0" });

  const resetForm = () => { setForm({ name: "", description: "", duration_minutes: "30", price: "0" }); setEditingId(null); };

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
      if (editingId) {
        const { error } = await supabase.from("procedures").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("procedures").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      toast.success(editingId ? "Procedimento atualizado!" : "Procedimento cadastrado!");
      setIsOpen(false);
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
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" /> Catálogo de Procedimentos
        </h2>
        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary gap-2 shadow-card">
              <Plus className="w-4 h-4" /> Novo Procedimento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Novo"} Procedimento</DialogTitle>
            </DialogHeader>
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
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>Cancelar</Button>
                <Button type="submit" className="bg-gradient-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
