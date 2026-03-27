import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCog, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import RolesTab from "./usuarios/RolesTab";

const UsuariosModule = () => {
  const { profile, hasRole, user, isSuperAdmin, hasTabAccess } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasRole("admin") || isSuperAdmin;
  const availableTabs = ["usuarios", "papeis"].filter(t => hasTabAccess("usuarios", t));

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

  // Fetch dynamic role definitions
  const { data: roleDefs = [] } = useQuery({
    queryKey: ["role-definitions", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("role_definitions")
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  // Fetch role assignments
  const { data: roleAssignments = [] } = useQuery({
    queryKey: ["role-assignments", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("user_role_assignments")
        .select("*")
        .eq("clinic_id", profile.clinic_id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const getUserAssignedRole = (userId: string) => {
    const assignment = roleAssignments.find((a: any) => a.user_id === userId);
    return assignment?.role_definition_id || "";
  };

  // Filter out users assigned to a Super Admin role
  const superAdminRoleIds = new Set(roleDefs.filter((r: any) => r.is_super_admin).map((r: any) => r.id));
  const filteredUsers = users.filter((u: any) => {
    const roleId = getUserAssignedRole(u.id);
    return !roleId || !superAdminRoleIds.has(roleId);
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleDefId }: { userId: string; roleDefId: string }) => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      // Remove existing assignments
      await supabase
        .from("user_role_assignments")
        .delete()
        .eq("user_id", userId)
        .eq("clinic_id", profile.clinic_id);

      if (roleDefId) {
        const { error } = await supabase.from("user_role_assignments").insert({
          user_id: userId,
          role_definition_id: roleDefId,
          clinic_id: profile.clinic_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-assignments"] });
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
    <Tabs defaultValue={availableTabs[0] || "usuarios"} className="space-y-6">
      <TabsList>
        {hasTabAccess("usuarios", "usuarios") && <TabsTrigger value="usuarios">Usuários</TabsTrigger>}
        {hasTabAccess("usuarios", "papeis") && <TabsTrigger value="papeis">Papéis</TabsTrigger>}
      </TabsList>

      <TabsContent value="usuarios">
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total de Usuários</p><p className="text-2xl font-bold text-foreground">{users.length}</p></CardContent></Card>
            <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Ativos</p><p className="text-2xl font-bold text-green-600">{users.filter((u: any) => u.is_active).length}</p></CardContent></Card>
            <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Inativos</p><p className="text-2xl font-bold text-red-600">{users.filter((u: any) => !u.is_active).length}</p></CardContent></Card>
          </div>

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
                      <TableHead>Papel</TableHead>
                      <TableHead>Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u: any) => {
                      const isSelf = u.id === user?.id;
                      const currentRoleId = getUserAssignedRole(u.id);
                      const currentRoleDef = roleDefs.find((r: any) => r.id === currentRoleId);
                      const isSuperAdminUser = currentRoleDef?.is_super_admin;

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
                            {isSuperAdminUser && !isSuperAdmin ? (
                              <Badge variant="destructive" className="text-xs">Super Admin</Badge>
                            ) : (
                              <Select
                                value={currentRoleId}
                                onValueChange={(val) =>
                                  assignRoleMutation.mutate({ userId: u.id, roleDefId: val })
                                }
                                disabled={isSuperAdminUser && !isSuperAdmin}
                              >
                                <SelectTrigger className="w-[180px] h-8 text-xs">
                                  <SelectValue placeholder="Sem papel" />
                                </SelectTrigger>
                                <SelectContent>
                                  {roleDefs
                                    .filter((r: any) => isSuperAdmin || !r.is_super_admin)
                                    .map((r: any) => (
                                      <SelectItem key={r.id} value={r.id}>
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: r.color }}
                                          />
                                          {r.name}
                                        </div>
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={u.is_active}
                              disabled={isSelf}
                              onCheckedChange={() =>
                                toggleActiveMutation.mutate({ userId: u.id, isActive: u.is_active })
                              }
                            />
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
      </TabsContent>

      <TabsContent value="papeis">
        <RolesTab />
      </TabsContent>
    </Tabs>
  );
};

export default UsuariosModule;
