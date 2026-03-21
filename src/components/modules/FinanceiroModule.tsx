import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DollarSign, Plus, TrendingUp, TrendingDown, Wallet, ChevronLeft,
  ChevronRight, CheckCircle, XCircle, Clock, Trash2, Edit, Users
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, addMonths, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const paymentMethods: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito", transferencia: "Transferência", boleto: "Boleto",
};

const statusColors: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  pago: "bg-green-100 text-green-700 border-green-300",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const FinanceiroModule = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTx, setEditTx] = useState<any>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);

  const clinicId = profile?.clinic_id;

  // Daily transactions
  const dayStr = format(selectedDate, "yyyy-MM-dd");
  const { data: dailyTx = [], isLoading: loadingDaily } = useQuery({
    queryKey: ["financial-daily", clinicId, dayStr],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*, clients(name), appointments(seq_number)")
        .eq("clinic_id", clinicId)
        .eq("date", dayStr)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clinicId,
  });

  // Monthly transactions
  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
  const { data: monthlyTx = [], isLoading: loadingMonthly } = useQuery({
    queryKey: ["financial-monthly", clinicId, monthStart],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*, clients(name), appointments(seq_number)")
        .eq("clinic_id", clinicId)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clinicId,
  });

  // Commissions
  const { data: commissions = [], isLoading: loadingComm } = useQuery({
    queryKey: ["commissions", clinicId, monthStart],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("commissions")
        .select("*, profiles(full_name), financial_transactions(description)")
        .eq("clinic_id", clinicId)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clinicId,
  });

  // Stats
  const dailyStats = useMemo(() => {
    const receitas = dailyTx.filter(t => t.type === "receita" && t.status !== "cancelado").reduce((s, t) => s + Number(t.amount), 0);
    const despesas = dailyTx.filter(t => t.type === "despesa" && t.status !== "cancelado").reduce((s, t) => s + Number(t.amount), 0);
    const pagos = dailyTx.filter(t => t.status === "pago" && t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
    const pendentes = dailyTx.filter(t => t.status === "pendente" && t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
    return { receitas, despesas, saldo: receitas - despesas, pagos, pendentes };
  }, [dailyTx]);

  const monthlyStats = useMemo(() => {
    const receitas = monthlyTx.filter(t => t.type === "receita" && t.status !== "cancelado").reduce((s, t) => s + Number(t.amount), 0);
    const despesas = monthlyTx.filter(t => t.type === "despesa" && t.status !== "cancelado").reduce((s, t) => s + Number(t.amount), 0);
    const pagos = monthlyTx.filter(t => t.status === "pago" && t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
    const pendentes = monthlyTx.filter(t => t.status === "pendente" && t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
    return { receitas, despesas, saldo: receitas - despesas, pagos, pendentes };
  }, [monthlyTx]);

  const commissionStats = useMemo(() => {
    const total = commissions.reduce((s, c) => s + Number(c.amount), 0);
    const pendente = commissions.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.amount), 0);
    const pago = commissions.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.amount), 0);
    return { total, pendente, pago };
  }, [commissions]);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("financial_transactions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-daily"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-daily"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
      toast.success("Transação excluída!");
      setDeleteTxId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCommissionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("commissions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      toast.success("Comissão atualizada!");
    },
  });

  const stats = tab === "daily" ? dailyStats : monthlyStats;
  const transactions = tab === "daily" ? dailyTx : monthlyTx;
  const loading = tab === "daily" ? loadingDaily : loadingMonthly;

  const StatsCards = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card className="shadow-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-success" />
            <p className="text-xs text-muted-foreground">Receitas</p>
          </div>
          <p className="text-xl font-bold text-success">R$ {stats.receitas.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <p className="text-xs text-muted-foreground">Despesas</p>
          </div>
          <p className="text-xl font-bold text-destructive">R$ {stats.despesas.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">Saldo</p>
          </div>
          <p className={`text-xl font-bold ${stats.saldo >= 0 ? "text-primary" : "text-destructive"}`}>
            R$ {stats.saldo.toFixed(2)}
          </p>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-warning" />
            <p className="text-xs text-muted-foreground">Pendente</p>
          </div>
          <p className="text-xl font-bold text-warning">R$ {stats.pendentes.toFixed(2)}</p>
        </CardContent>
      </Card>
    </div>
  );

  const TxTable = ({ data }: { data: any[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          {tab === "monthly" && <TableHead>Data</TableHead>}
          <TableHead>Descrição</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead className="hidden md:table-cell">Pagamento</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((tx) => (
          <TableRow key={tx.id}>
            {tab === "monthly" && (
              <TableCell className="text-xs whitespace-nowrap">
                {format(new Date(tx.date), "dd/MM", { locale: ptBR })}
              </TableCell>
            )}
            <TableCell>
              <div>
                <p className="font-medium text-sm">{tx.description}</p>
                {tx.clients?.name && <p className="text-xs text-muted-foreground">{tx.clients.name}</p>}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={tx.type === "receita" ? "default" : "destructive"} className="text-xs">
                {tx.type === "receita" ? "Receita" : "Despesa"}
              </Badge>
            </TableCell>
            <TableCell className={`font-semibold ${tx.type === "receita" ? "text-success" : "text-destructive"}`}>
              {tx.type === "receita" ? "+" : "-"} R$ {Number(tx.amount).toFixed(2)}
            </TableCell>
            <TableCell className="hidden md:table-cell text-xs">
              {paymentMethods[tx.payment_method] || tx.payment_method || "—"}
            </TableCell>
            <TableCell>
              <Select value={tx.status} onValueChange={(v) => updateStatusMutation.mutate({ id: tx.id, status: v })}>
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditTx(tx); setIsCreateOpen(true); }}>
                  <Edit className="w-4 h-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteTxId(tx.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <TabsList>
            <TabsTrigger value="daily">Caixa Diário</TabsTrigger>
            <TabsTrigger value="monthly">Caixa Mensal</TabsTrigger>
            <TabsTrigger value="commissions">Comissões</TabsTrigger>
          </TabsList>

          <div className="flex gap-2 items-center">
            {tab !== "commissions" && (
              <>
                <Button size="icon" variant="outline" onClick={() => tab === "daily" ? setSelectedDate(d => addDays(d, -1)) : setSelectedMonth(d => addMonths(d, -1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-[150px] text-center">
                  {tab === "daily"
                    ? format(selectedDate, "EEEE, dd/MM", { locale: ptBR })
                    : format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button size="icon" variant="outline" onClick={() => tab === "daily" ? setSelectedDate(d => addDays(d, 1)) : setSelectedMonth(d => addMonths(d, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                {tab === "daily" && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>Hoje</Button>
                )}
              </>
            )}
            {tab === "commissions" && (
              <>
                <Button size="icon" variant="outline" onClick={() => setSelectedMonth(d => addMonths(d, -1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-[150px] text-center">
                  {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button size="icon" variant="outline" onClick={() => setSelectedMonth(d => addMonths(d, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}
            {tab !== "commissions" && (
              <Button className="bg-gradient-primary gap-2 shadow-card" onClick={() => { setEditTx(null); setIsCreateOpen(true); }}>
                <Plus className="w-4 h-4" /> Nova Transação
              </Button>
            )}
          </div>
        </div>

        {/* Daily */}
        <TabsContent value="daily" className="space-y-6 mt-4">
          <StatsCards />
          <Card className="shadow-card">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando...</div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma transação neste dia.</div>
              ) : (
                <TxTable data={transactions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly */}
        <TabsContent value="monthly" className="space-y-6 mt-4">
          <StatsCards />
          <Card className="shadow-card">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando...</div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma transação neste mês.</div>
              ) : (
                <TxTable data={transactions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commissions */}
        <TabsContent value="commissions" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Total Comissões</p>
                </div>
                <p className="text-xl font-bold text-foreground">R$ {commissionStats.total.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-warning" />
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
                <p className="text-xl font-bold text-warning">R$ {commissionStats.pendente.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <p className="text-xs text-muted-foreground">Pagas</p>
                </div>
                <p className="text-xl font-bold text-success">R$ {commissionStats.pago.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>
          <Card className="shadow-card">
            <CardContent className="p-0">
              {loadingComm ? (
                <div className="p-8 text-center text-muted-foreground">Carregando...</div>
              ) : commissions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma comissão neste mês.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{format(new Date(c.date), "dd/MM", { locale: ptBR })}</TableCell>
                        <TableCell className="font-medium">{c.profiles?.full_name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.financial_transactions?.description || "—"}</TableCell>
                        <TableCell>{Number(c.percentage).toFixed(0)}%</TableCell>
                        <TableCell className="font-semibold text-primary">R$ {Number(c.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Select value={c.status} onValueChange={(v) => updateCommissionStatus.mutate({ id: c.id, status: v })}>
                            <SelectTrigger className="h-7 w-[100px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="pago">Pago</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Transaction Dialog */}
      <TransactionFormDialog
        open={isCreateOpen}
        onOpenChange={(o) => { if (!o) setEditTx(null); setIsCreateOpen(o); }}
        clinicId={clinicId || ""}
        editTx={editTx}
        defaultDate={tab === "daily" ? dayStr : undefined}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTxId} onOpenChange={(o) => !o && setDeleteTxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transação</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTxId && deleteMutation.mutate(deleteTxId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ===================== TRANSACTION FORM =====================
function TransactionFormDialog({ open, onOpenChange, clinicId, editTx, defaultDate }: {
  open: boolean; onOpenChange: (o: boolean) => void; clinicId: string; editTx: any; defaultDate?: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: "receita", category: "atendimento", description: "",
    amount: "", payment_method: "pix", status: "pendente",
    date: defaultDate || format(new Date(), "yyyy-MM-dd"), notes: "",
  });
  const [loaded, setLoaded] = useState(false);

  if (editTx && !loaded) {
    setForm({
      type: editTx.type, category: editTx.category || "atendimento",
      description: editTx.description, amount: String(editTx.amount),
      payment_method: editTx.payment_method || "pix", status: editTx.status,
      date: editTx.date, notes: editTx.notes || "",
    });
    setLoaded(true);
  }

  const reset = () => {
    setForm({
      type: "receita", category: "atendimento", description: "",
      amount: "", payment_method: "pix", status: "pendente",
      date: defaultDate || format(new Date(), "yyyy-MM-dd"), notes: "",
    });
    setLoaded(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("Sem clínica");
      const payload = {
        clinic_id: clinicId,
        type: form.type, category: form.category, description: form.description,
        amount: parseFloat(form.amount) || 0, payment_method: form.payment_method,
        status: form.status, date: form.date, notes: form.notes || null,
      };
      if (editTx) {
        const { error } = await supabase.from("financial_transactions").update(payload).eq("id", editTx.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-daily"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
      toast.success(editTx ? "Transação atualizada!" : "Transação criada!");
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            {editTx ? "Editar Transação" : "Nova Transação"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendimento">Atendimento</SelectItem>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="aluguel">Aluguel</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="salario">Salário</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Tratamento de unha encravada" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentMethods).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
            <Button type="submit" className="bg-gradient-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editTx ? "Atualizar" : "Criar Transação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default FinanceiroModule;
