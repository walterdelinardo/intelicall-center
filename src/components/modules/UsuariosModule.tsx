import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCog, Shield, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import RolesTab from "./usuarios/RolesTab";

const UsuariosModule = () => {
  const { profile, hasRole, user, isSuperAdmin, hasTabAccess, hasModuleAccess } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasRole("admin") || isSuperAdmin || hasModuleAccess("usuarios", "edit");
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

  const getUserAssignedRoles = (userId: string): string[] => {
    return roleAssignments
      .filter((a: any) => a.user_id === userId)
      .map((a: any) => a.role_definition_id);
  };

  const superAdminRoleIds = new Set(roleDefs.filter((r: any) => r.is_super_admin).map((r: any) => r.id));

  const filteredUsers = users.filter((u: any) => {
    const roleIds = getUserAssignedRoles(u.id);
    return !roleIds.some(id => superAdminRoleIds.has(id));
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, roleDefId, action }: { userId: string; roleDefId: string; action: "add" | "remove" }) => {
      if (!profile?.clinic_id) throw new Error("Sem clínica");
      if (action === "add") {
        const { error } = await supabase.from("user_role_assignments").insert({
          user_id: userId,
          role_definition_id: roleDefId,
          clinic_id: profile.clinic_id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_role_assignments")
          .delete()
          .eq("user_id", userId)
          .eq("role_definition_id", roleDefId)
          .eq("clinic_id", profile.clinic_id);
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

  const availableRolesForSelect = roleDefs.filter((r: any) => isSuperAdmin || !r.is_super_admin);

  return (
    <Tabs defaultValue={availableTabs[0] || "usuarios"} className="space-y-6">
      <TabsList>
        {hasTabAccess("usuarios", "usuarios") && <TabsTrigger value="usuarios">Usuários</TabsTrigger>}
        {hasTabAccess("usuarios", "papeis") && <TabsTrigger value="papeis">Papéis</TabsTrigger>}
      </TabsList>

      <TabsContent value="usuarios">
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total de Usuários</p><p className="text-2xl font-bold text-foreground">{filteredUsers.length}</p></CardContent></Card>
            <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Ativos</p><p className="text-2xl font-bold text-green-600">{filteredUsers.filter((u: any) => u.is_active).length}</p></CardContent></Card>
            <Card className="shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Inativos</p><p className="text-2xl font-bold text-red-600">{filteredUsers.filter((u: any) => !u.is_active).length}</p></CardContent></Card>
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
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Papéis</TableHead>
                      <TableHead>Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u: any) => {
                      const isSelf = u.id === user?.id;
                      const userRoleIds = getUserAssignedRoles(u.id);
                      const hasSuperAdminRole = userRoleIds.some(id => superAdminRoleIds.has(id));

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
                            {hasSuperAdminRole && !isSuperAdmin ? (
                              <Badge variant="destructive" className="text-xs">Super Admin</Badge>
                            ) : (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-auto min-h-8 py-1 px-2 flex flex-wrap gap-1 items-center max-w-[260px]">
                                    {userRoleIds.length === 0 ? (
                                      <span className="text-xs text-muted-foreground">Sem papel</span>
                                    ) : (
                                      userRoleIds.map(roleId => {
                                        const rd = roleDefs.find((r: any) => r.id === roleId);
                                        if (!rd) return null;
                                        return (
                                          <Badge
                                            key={roleId}
                                            variant="secondary"
                                            className="text-xs"
                                            style={{ backgroundColor: rd.color + "22", color: rd.color, borderColor: rd.color }}
                                          >
                                            {rd.name}
                                          </Badge>
                                        );
                                      })
                                    )}
                                    <ChevronDown className="w-3 h-3 ml-1 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2" align="start">
                                  <div className="space-y-1">
                                    {availableRolesForSelect.map((r: any) => {
                                      const checked = userRoleIds.includes(r.id);
                                      return (
                                        <label
                                          key={r.id}
                                          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
                                        >
                                          <Checkbox
                                            checked={checked}
                                            onCheckedChange={() =>
                                              toggleRoleMutation.mutate({
                                                userId: u.id,
                                                roleDefId: r.id,
                                                action: checked ? "remove" : "add",
                                              })
                                            }
                                          />
                                          <div
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: r.color }}
                                          />
                                          {r.name}
                                        </label>
                                      );
                                    })}
                                    {availableRolesForSelect.length === 0 && (
                                      <p className="text-xs text-muted-foreground p-2">Nenhum papel cadastrado.</p>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
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
