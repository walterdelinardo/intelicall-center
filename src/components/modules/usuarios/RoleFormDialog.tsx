import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

interface ModuleDef {
  key: string;
  label: string;
}

interface PermState {
  can_read: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleDefinition | null;
  allModules: ModuleDef[];
  existingPermissions: RolePermission[];
}

const COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6",
  "#8B5CF6", "#EC4899", "#6B7280", "#DC2626", "#0EA5E9",
];

const RoleFormDialog = ({ open, onOpenChange, role, allModules, existingPermissions }: Props) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!role;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [perms, setPerms] = useState<Record<string, PermState>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (role) {
        setName(role.name);
        setSlug(role.slug);
        setColor(role.color);
        // Load existing permissions
        const permMap: Record<string, PermState> = {};
        allModules.forEach((m) => {
          const existing = existingPermissions.find(
            (p) => p.role_definition_id === role.id && p.module_key === m.key
          );
          permMap[m.key] = {
            can_read: existing?.can_read || false,
            can_edit: existing?.can_edit || false,
            can_delete: existing?.can_delete || false,
          };
        });
        setPerms(permMap);
      } else {
        setName("");
        setSlug("");
        setColor("#3B82F6");
        const permMap: Record<string, PermState> = {};
        allModules.forEach((m) => {
          permMap[m.key] = { can_read: false, can_edit: false, can_delete: false };
        });
        setPerms(permMap);
      }
    }
  }, [open, role, existingPermissions]);

  const generateSlug = (val: string) =>
    val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const togglePerm = (moduleKey: string, field: keyof PermState) => {
    setPerms((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [field]: !prev[moduleKey][field] },
    }));
  };

  const toggleAllRead = () => {
    const allChecked = allModules.every((m) => perms[m.key]?.can_read);
    setPerms((prev) => {
      const next = { ...prev };
      allModules.forEach((m) => {
        next[m.key] = { ...next[m.key], can_read: !allChecked };
      });
      return next;
    });
  };

  const toggleAllEdit = () => {
    const allChecked = allModules.every((m) => perms[m.key]?.can_edit);
    setPerms((prev) => {
      const next = { ...prev };
      allModules.forEach((m) => {
        next[m.key] = { ...next[m.key], can_edit: !allChecked };
      });
      return next;
    });
  };

  const toggleAllDelete = () => {
    const allChecked = allModules.every((m) => perms[m.key]?.can_delete);
    setPerms((prev) => {
      const next = { ...prev };
      allModules.forEach((m) => {
        next[m.key] = { ...next[m.key], can_delete: !allChecked };
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim() || !profile?.clinic_id) return;
    setSaving(true);

    try {
      const finalSlug = slug || generateSlug(name);
      let roleId: string;

      if (isEditing && role) {
        const { error } = await supabase
          .from("role_definitions")
          .update({ name, slug: finalSlug, color })
          .eq("id", role.id);
        if (error) throw error;
        roleId = role.id;

        // Delete old permissions
        await supabase.from("role_permissions").delete().eq("role_definition_id", roleId);
      } else {
        const { data, error } = await supabase
          .from("role_definitions")
          .insert({
            clinic_id: profile.clinic_id,
            name,
            slug: finalSlug,
            color,
            is_system: false,
            is_super_admin: false,
          })
          .select("id")
          .single();
        if (error) throw error;
        roleId = data.id;
      }

      // Insert permissions
      const permRows = allModules
        .filter((m) => perms[m.key]?.can_read || perms[m.key]?.can_edit || perms[m.key]?.can_delete)
        .map((m) => ({
          role_definition_id: roleId,
          module_key: m.key,
          can_read: perms[m.key].can_read,
          can_edit: perms[m.key].can_edit,
          can_delete: perms[m.key].can_delete,
        }));

      if (permRows.length > 0) {
        const { error } = await supabase.from("role_permissions").insert(permRows);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["role-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success(isEditing ? "Papel atualizado!" : "Papel criado!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Papel" : "Novo Papel"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!isEditing) setSlug(generateSlug(e.target.value));
                }}
                placeholder="Ex: Recepcionista"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="recepcionista"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Permissões por Módulo</Label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 font-medium">Módulo</th>
                    <th className="text-center p-2 font-medium w-20">
                      <button onClick={toggleAllRead} className="hover:underline">Ler</button>
                    </th>
                    <th className="text-center p-2 font-medium w-20">
                      <button onClick={toggleAllEdit} className="hover:underline">Editar</button>
                    </th>
                    <th className="text-center p-2 font-medium w-20">
                      <button onClick={toggleAllDelete} className="hover:underline">Excluir</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allModules.map((m) => (
                    <tr key={m.key} className="border-t border-border">
                      <td className="p-2">{m.label}</td>
                      <td className="text-center p-2">
                        <Checkbox
                          checked={perms[m.key]?.can_read || false}
                          onCheckedChange={() => togglePerm(m.key, "can_read")}
                        />
                      </td>
                      <td className="text-center p-2">
                        <Checkbox
                          checked={perms[m.key]?.can_edit || false}
                          onCheckedChange={() => togglePerm(m.key, "can_edit")}
                        />
                      </td>
                      <td className="text-center p-2">
                        <Checkbox
                          checked={perms[m.key]?.can_delete || false}
                          onCheckedChange={() => togglePerm(m.key, "can_delete")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {isEditing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoleFormDialog;
