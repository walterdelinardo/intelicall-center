import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import RoleFormDialog from "./RoleFormDialog";

const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "agenda", label: "Agenda" },
  { key: "clientes", label: "Clientes" },
  { key: "conversas", label: "Conversas" },
  { key: "prontuarios", label: "Prontuários" },
  { key: "procedimentos", label: "Procedimentos" },
  { key: "lista-espera", label: "Lista de Espera" },
  { key: "financeiro", label: "Financeiro" },
  { key: "estoque", label: "Estoque" },
  { key: "leads", label: "Leads & Funil" },
  { key: "usuarios", label: "Usuários" },
  { key: "configuracoes", label: "Configurações" },
];

const MODULE_TABS: Record<string, { key: string; label: string }[]> = {
  agenda: [
    { key: "calendario", label: "Calendário" },
    { key: "notificacoes", label: "Notificações" },
  ],
  conversas: [
    { key: "whatsapp", label: "WhatsApp" },
    { key: "telegram", label: "Notificações Telegram" },
  ],
  financeiro: [
    { key: "daily", label: "Caixa Diário" },
    { key: "monthly", label: "Caixa Mensal" },
    { key: "commissions", label: "Comissões" },
  ],
  usuarios: [
    { key: "usuarios", label: "Usuários" },
    { key: "papeis", label: "Papéis" },
  ],
  configuracoes: [
    { key: "general", label: "Dados Gerais" },
    { key: "hours", label: "Horários" },
    { key: "integrations", label: "Integrações" },
  ],
};

export { ALL_MODULES, MODULE_TABS };

interface RoleDefinition {
  id: string;
  clinic_id: string;
  name: string;
  slug: string;
  color: string;
  is_system: boolean;
  is_super_admin: boolean;
}

interface RolePermission {
  id: string;
  role_definition_id: string;
  module_key: string;
  can_read: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const RolesTab = () => {
  const { profile, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: roleDefs = [], isLoading } = useQuery({
    queryKey: ["role-definitions", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from("role_definitions")
        .select("*")
        .eq("clinic_id", profile.clinic_id)
        .order("is_super_admin", { ascending: false })
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as RoleDefinition[];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: allPermissions = [] } = useQuery({
    queryKey: ["role-permissions", profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const roleIds = roleDefs.map((r) => r.id);
      if (roleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .in("role_definition_id", roleIds);
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: roleDefs.length > 0,
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("role_definitions").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Papel excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getPermCount = (roleId: string) => {
    const perms = allPermissions.filter((p) => p.role_definition_id === roleId);
    const readCount = perms.filter((p) => p.can_read).length;
    const editCount = perms.filter((p) => p.can_edit).length;
    const deleteCount = perms.filter((p) => p.can_delete).length;
    return { readCount, editCount, deleteCount };
  };

  const handleEdit = (role: RoleDefinition) => {
    setEditingRole(role);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRole(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Papéis do Sistema
          </CardTitle>
          <Button onClick={handleCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Novo Papel
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </div>
          ) : roleDefs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum papel cadastrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Papel</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleDefs.map((role) => {
                  const { readCount, editCount, deleteCount } = getPermCount(role.id);
                  const isProtected = role.is_super_admin || role.is_system;
                  return (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="font-medium">{role.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {role.slug}
                      </TableCell>
                      <TableCell>
                        {role.is_super_admin ? (
                          <Badge variant="destructive" className="text-[10px]">Acesso Total</Badge>
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              👁 {readCount}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              ✏️ {editCount}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              🗑 {deleteCount}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {role.is_super_admin ? (
                          <Badge variant="destructive" className="text-[10px]">Super Admin</Badge>
                        ) : role.is_system ? (
                          <Badge variant="secondary" className="text-[10px]">Sistema</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {role.is_super_admin ? (
                          <span className="text-xs text-muted-foreground">Protegido</span>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(role)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {!isProtected && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("Excluir este papel?")) {
                                    deleteRoleMutation.mutate(role.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editingRole}
        allModules={ALL_MODULES}
        existingPermissions={allPermissions}
      />
    </div>
  );
};

export default RolesTab;
