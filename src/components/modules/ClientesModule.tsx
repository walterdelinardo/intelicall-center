import { useState, useMemo, useCallback } from "react";
import { fetchViaCep } from "@/lib/viaCep";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, MessageSquare, Edit, Eye, Trash2, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ClientDetailsDialog from "./clients/ClientDetailsDialog";
import { useDashboard } from "@/contexts/DashboardContext";

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
  whatsapp_inbox_id: string | null;
}

interface Inbox {
  id: string;
  instance_name: string;
  label: string;
  is_active: boolean;
}

type SortField = "name" | "total_visits" | "last_visit_at" | "created_at" | "average_ticket";
type SortDir = "asc" | "desc";

const emptyForm = {
  name: "", phone: "", whatsapp: "", email: "", birth_date: "",
  cpf: "", address: "", city: "", state: "", zip_code: "", notes: "", lead_source: "",
};

const ClientesModule = () => {
  const { profile } = useAuth();
  const { openChatWithPhone } = useDashboard();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterInbox, setFilterInbox] = useState<string>("all");

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

  const { data: inboxes = [] } = useQuery({
    queryKey: ["whatsapp-inboxes", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("whatsapp_inboxes").select("id, instance_name, label, is_active")
        .eq("clinic_id", profile.clinic_id).eq("is_active", true);
      if (error) throw error;
      return data as Inbox[];
    },
    enabled: !!profile?.clinic_id,
  });

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

  const inboxMap = useMemo(() => {
    const map: Record<string, string> = {};
    inboxes.forEach((i) => { map[i.id] = i.label; });
    return map;
  }, [inboxes]);

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
      // Sync name/phone to WhatsApp conversations if client has a WhatsApp inbox
      if (editClient?.whatsapp_inbox_id) {
        supabase.functions.invoke("update-whatsapp-contact", {
          body: { client_id: editClient.id },
        }).then(({ error }) => {
          if (error) console.error("Erro ao sincronizar contato WhatsApp:", error);
        });
      }
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

  const handleSync = async (instanceName?: string) => {
    setIsSyncing(true);
    setIsSyncDialogOpen(false);
    try {
      const body = instanceName ? { instance_name: instanceName } : undefined;
      const { data, error } = await supabase.functions.invoke("sync-evolution-contacts", { body });
      if (error) throw error;
      const r = data as { total_contacts: number; created: number; updated: number; skipped: number; errors: number };
      toast.success(
        `Sincronização concluída: ${r.created} criados, ${r.updated} atualizados, ${r.skipped} ignorados` +
        (r.errors > 0 ? `, ${r.errors} erros` : "")
      );
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (e: any) {
      toast.error("Erro na sincronização: " + (e.message || "Erro desconhecido"));
    } finally {
      setIsSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    let result = clients.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.whatsapp?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (filterSource !== "all") {
      result = result.filter((c) => (c.lead_source || "") === filterSource);
    }
    if (filterStatus !== "all") {
      result = result.filter((c) => filterStatus === "active" ? c.is_active : !c.is_active);
    }
    if (filterInbox !== "all") {
      if (filterInbox === "none") {
        result = result.filter((c) => !c.whatsapp_inbox_id);
      } else {
        result = result.filter((c) => c.whatsapp_inbox_id === filterInbox);
      }
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "total_visits":
          cmp = a.total_visits - b.total_visits;
          break;
        case "average_ticket":
          cmp = (a.average_ticket || 0) - (b.average_ticket || 0);
          break;
        case "last_visit_at":
          cmp = (a.last_visit_at || "").localeCompare(b.last_visit_at || "");
          break;
        case "created_at":
          cmp = a.created_at.localeCompare(b.created_at);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [clients, search, filterSource, filterStatus, filterInbox, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 ml-1 text-primary" />
      : <ArrowDown className="w-3 h-3 ml-1 text-primary" />;
  };

  const today = new Date();
  const currentMonth = today.getMonth();
  const birthdays = clients.filter((c) => c.birth_date && new Date(c.birth_date).getMonth() === currentMonth);
  const noReturnDays = 60;
  const noReturn = clients.filter((c) => {
    if (!c.last_visit_at) return true;
    return (today.getTime() - new Date(c.last_visit_at).getTime()) / (1000 * 60 * 60 * 24) > noReturnDays;
  });

  const leadSources = useMemo(() => {
    const sources = new Set<string>();
    clients.forEach((c) => { if (c.lead_source) sources.add(c.lead_source); });
    return Array.from(sources).sort();
  }, [clients]);

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
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={isSyncing}
            onClick={() => setIsSyncDialogOpen(true)}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar WhatsApp"}
          </Button>
          <Button className="bg-gradient-primary gap-2 shadow-card" onClick={() => { resetForm(); setIsFormOpen(true); }}>
            <Plus className="w-4 h-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {leadSources.map((s) => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterInbox} onValueChange={setFilterInbox}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Instância" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas instâncias</SelectItem>
            <SelectItem value="none">Sem instância</SelectItem>
            {inboxes.map((i) => (
              <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterSource !== "all" || filterStatus !== "all" || filterInbox !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterSource("all"); setFilterStatus("all"); setFilterInbox("all"); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Sync Dialog */}
      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sincronizar Contatos do WhatsApp</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecione a instância para sincronizar os contatos ou sincronize todas de uma vez.
          </p>
          <div className="space-y-3 mt-2">
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              onClick={() => handleSync()}
            >
              <RefreshCw className="w-4 h-4" />
              Sincronizar todas as instâncias
            </Button>
            {inboxes.map((inbox) => (
              <Button
                key={inbox.id}
                className="w-full justify-start gap-2"
                variant="outline"
                onClick={() => handleSync(inbox.instance_name)}
              >
                <MessageSquare className="w-4 h-4 text-success" />
                {inbox.label}
                <span className="text-xs text-muted-foreground ml-auto">{inbox.instance_name}</span>
              </Button>
            ))}
            {inboxes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma instância ativa encontrada. Configure nas Integrações.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) resetForm(); setIsFormOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editClient ? "Editar Cliente" : "Cadastrar Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {search || filterSource !== "all" || filterStatus !== "all" || filterInbox !== "all"
                ? "Nenhum cliente encontrado com os filtros aplicados."
                : "Nenhum cliente cadastrado. Clique em 'Novo Cliente' para começar."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    <span className="flex items-center">Nome <SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell cursor-pointer select-none" onClick={() => toggleSort("total_visits")}>
                    <span className="flex items-center">Visitas <SortIcon field="total_visits" /></span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort("last_visit_at")}>
                    <span className="flex items-center">Última Visita <SortIcon field="last_visit_at" /></span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Instância</TableHead>
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
                    <TableCell className="hidden lg:table-cell">
                      {client.whatsapp_inbox_id && inboxMap[client.whatsapp_inbox_id]
                        ? <Badge variant="outline" className="text-xs">{inboxMap[client.whatsapp_inbox_id]}</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
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
                          <Button size="icon" variant="ghost" onClick={() => openChatWithPhone(client.whatsapp!, client.name)}>
                            <MessageSquare className="w-4 h-4 text-success" />
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
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
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
