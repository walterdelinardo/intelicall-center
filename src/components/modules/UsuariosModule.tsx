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
import { Switch } from "@/components/ui/switch";
import { UserCog, Plus, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcao: "Recepção",
  podologo: "Podólogo(a)",
  financeiro: "Financeiro",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-300",
  recepcao: "bg-blue-100 text-blue-700 border-blue-300",
  podologo: "bg-green-100 text-green-700 border-green-300",
  financeiro: "bg-yellow-100 text-yellow-700 border-yellow-300",
};

const UsuariosModule = () => {
  const { profile, hasRole, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasRole("admin");

  // Fetch all profiles in same clinic
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["clinic-users", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  // Fetch roles for all users
  const { data: allRoles = [] } = useQuery({
    queryKey: ["clinic-roles", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("clinic_id", profile.clinic_id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const getUserRoles = (userId: string) =>
    allRoles.filter((r: any) => r.user_id === userId).map((r: any) => r.role);

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role, hasIt }: { userId: string; role: string; hasIt: boolean }) => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      if (hasIt) {
        const { error } = await supabase.from("user_roles").delete()
          .eq("user_id", userId).eq("role", role as any).eq("clinic_id", profile.clinic_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({
          user_id: userId,
          role: role as any,
          clinic_id: profile.clinic_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-roles"] });
      toast.success("Papel atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: !isActive }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-users"] });
      toast.success("Status atualizado!");
    },
  });

  if (!isAdmin) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-8 text-center text-muted-foreground">
          Apenas administradores podem gerenciar usuários.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total de Usuários</p><p className="text-2xl font-bold text-foreground">{users.length}</p></CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Ativos</p><p className="text-2xl font-bold text-green-600">{users.filter((u: any) => u.is_active).length}</p></CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Inativos</p><p className="text-2xl font-bold text-red-600">{users.filter((u: any) => !u.is_active).length}</p></CardContent></Card>
      </div>

      {/* Users Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            Usuários da Clínica
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Gerenciar Papéis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => {
                  const roles = getUserRoles(u.id);
                  const isSelf = u.id === user?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sem papel</span>
                          ) : (
                            roles.map((r: string) => (
                              <Badge key={r} variant="outline" className={`text-xs ${ROLE_COLORS[r] || ""}`}>
                                {ROLE_LABELS[r] || r}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.is_active}
                          disabled={isSelf}
                          onCheckedChange={() => toggleActiveMutation.mutate({ userId: u.id, isActive: u.is_active })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {Object.keys(ROLE_LABELS).map((role) => {
                            const hasIt = roles.includes(role);
                            const disableRemoveAdmin = role === "admin" && isSelf;
                            return (
                              <button
                                key={role}
                                disabled={disableRemoveAdmin}
                                onClick={() => toggleRoleMutation.mutate({ userId: u.id, role, hasIt })}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                  hasIt
                                    ? ROLE_COLORS[role] + " font-semibold"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                                } ${disableRemoveAdmin ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                              >
                                {ROLE_LABELS[role]}
                              </button>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card border-muted">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2"><Shield className="w-4 h-4" /> Para adicionar novos usuários, peça que criem uma conta e depois associe-os à clínica.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsuariosModule;
