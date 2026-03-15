import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Search, Phone, Mail, Calendar, MessageSquare, Edit, Eye, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ClientDetailsDialog from "./clients/ClientDetailsDialog";

interface Client {
  id: string;
  clinic_id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  birth_date: string | null;
  cpf: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  lead_source: string | null;
  total_visits: number;
  last_visit_at: string | null;
  average_ticket: number;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  name: "", phone: "", whatsapp: "", email: "", birth_date: "",
  cpf: "", address: "", city: "", state: "", zip_code: "", notes: "", lead_source: "",
};

const ClientesModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);

  const [form, setForm] = useState({ ...emptyForm });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditClient(null);
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    setForm({
      name: client.name, phone: client.phone || "", whatsapp: client.whatsapp || "",
      email: client.email || "", birth_date: client.birth_date || "", cpf: client.cpf || "",
      address: client.address || "", city: client.city || "", state: client.state || "",
      zip_code: client.zip_code || "", notes: client.notes || "", lead_source: client.lead_source || "",
    });
    setIsFormOpen(true);
  };

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("clients").select("*").eq("clinic_id", profile.clinic_id).order("name");
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!profile?.clinic_id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      const payload = {
        name: form.name,
        phone: form.phone || null, whatsapp: form.whatsapp || null,
        email: form.email || null, birth_date: form.birth_date || null,
        cpf: form.cpf || null, address: form.address || null,
        city: form.city || null, state: form.state || null,
        zip_code: form.zip_code || null, notes: form.notes || null,
        lead_source: form.lead_source || null,
      };

      if (editClient) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({ ...payload, clinic_id: profile.clinic_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editClient ? "Cliente atualizado!" : "Cliente cadastrado com sucesso!");
      setIsFormOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente excluído!");
      setDeleteClientId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.whatsapp?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date();
  const currentMonth = today.getMonth();
  const birthdays = clients.filter((c) => {
    if (!c.birth_date) return false;
    return new Date(c.birth_date).getMonth() === currentMonth;
  });

  const noReturnDays = 60;
  const noReturn = clients.filter((c) => {
    if (!c.last_visit_at) return true;
    const diff = (today.getTime() - new Date(c.last_visit_at).getTime()) / (1000 * 60 * 60 * 24);
    return diff > noReturnDays;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total de Clientes</p>
            <p className="text-2xl font-bold text-foreground">{clients.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Aniversariantes do Mês</p>
            <p className="text-2xl font-bold text-primary">{birthdays.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Sem Retorno (+{noReturnDays}d)</p>
            <p className="text-2xl font-bold text-warning">{noReturn.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Clientes Ativos</p>
            <p className="text-2xl font-bold text-success">{clients.filter(c => c.is_active).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone, email..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button className="bg-gradient-primary gap-2 shadow-card" onClick={() => { resetForm(); setIsFormOpen(true); }}>
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      {/* Form Dialog (Create + Edit) */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) resetForm(); setIsFormOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editClient ? "Editar Cliente" : "Cadastrar Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 9999-9999" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>Origem do Lead</Label>
              <Select value={form.lead_source} onValueChange={(v) => setForm({ ...form, lead_source: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setIsFormOpen(false); resetForm(); }}>Cancelar</Button>
              <Button type="submit" className="bg-gradient-primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editClient ? "Atualizar Cliente" : "Salvar Cliente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado. Clique em 'Novo Cliente' para começar."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Visitas</TableHead>
                  <TableHead className="hidden lg:table-cell">Última Visita</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{client.name}</span>
                        {client.lead_source && (
                          <Badge variant="secondary" className="ml-2 text-xs">{client.lead_source}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{client.phone || client.whatsapp || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.email || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{client.total_visits}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {client.last_visit_at
                        ? format(new Date(client.last_visit_at), "dd/MM/yyyy", { locale: ptBR })
                        : "Nunca"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setSelectedClient(client); setIsDetailsOpen(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(client)}>
                          <Edit className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteClientId(client.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                        {client.whatsapp && (
                          <Button size="icon" variant="ghost" asChild>
                            <a href={`https://wa.me/55${client.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                              <MessageSquare className="w-4 h-4 text-success" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details dialog */}
      {selectedClient && (
        <ClientDetailsDialog client={selectedClient} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteClientId} onOpenChange={(o) => !o && setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita. Todos os prontuários e agendamentos associados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteClientId && deleteMutation.mutate(deleteClientId)}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientesModule;
