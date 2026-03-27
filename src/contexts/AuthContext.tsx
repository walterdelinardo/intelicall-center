import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "recepcao" | "podologo" | "financeiro";

interface Profile {
  id: string;
  clinic_id: string | null;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
}

interface ModulePermission {
  module_key: string;
  can_read: boolean;
  can_edit: boolean;
  can_delete: boolean;
  allowed_tabs: string[] | null;
}

interface RoleDefinition {
  id: string;
  name: string;
  slug: string;
  color: string;
  is_system: boolean;
  is_super_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isSuperAdmin: boolean;
  assignedRoles: RoleDefinition[];
  modulePermissions: ModulePermission[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasModuleAccess: (moduleKey: string, action?: "read" | "edit" | "delete") => boolean;
  hasTabAccess: (moduleKey: string, tabKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [assignedRoles, setAssignedRoles] = useState<RoleDefinition[]>([]);
  const [modulePermissions, setModulePermissions] = useState<ModulePermission[]>([]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  };

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((data || []).map((r: any) => r.role as AppRole));
  };

  const fetchDynamicPermissions = async (userId: string) => {
    // Fetch user_role_assignments with role_definitions
    const { data: assignments } = await supabase
      .from("user_role_assignments")
      .select("role_definition_id")
      .eq("user_id", userId);

    if (!assignments || assignments.length === 0) {
      setIsSuperAdmin(false);
      setAssignedRoles([]);
      setModulePermissions([]);
      return;
    }

    const roleDefIds = assignments.map((a: any) => a.role_definition_id);

    // Fetch role definitions
    const { data: roleDefs } = await supabase
      .from("role_definitions")
      .select("*")
      .in("id", roleDefIds);

    const defs = (roleDefs || []) as RoleDefinition[];
    setAssignedRoles(defs);

    const hasSuperAdmin = defs.some((rd) => rd.is_super_admin);
    setIsSuperAdmin(hasSuperAdmin);

    if (hasSuperAdmin) {
      // Super admin has all permissions, no need to fetch
      setModulePermissions([]);
      return;
    }

    // Fetch permissions for all assigned roles
    const { data: perms } = await supabase
      .from("role_permissions")
      .select("*")
      .in("role_definition_id", roleDefIds);

    // Merge permissions across roles (OR logic)
    const permMap: Record<string, ModulePermission> = {};
    (perms || []).forEach((p: any) => {
      if (!permMap[p.module_key]) {
        permMap[p.module_key] = {
          module_key: p.module_key,
          can_read: false,
          can_edit: false,
          can_delete: false,
          allowed_tabs: p.allowed_tabs || null,
        };
      } else {
        // Merge allowed_tabs: if either is null (full access), result is null
        const existing = permMap[p.module_key].allowed_tabs;
        const incoming = p.allowed_tabs as string[] | null;
        if (existing === null || incoming === null) {
          permMap[p.module_key].allowed_tabs = null;
        } else {
          // Union of tabs
          const merged = Array.from(new Set([...existing, ...incoming]));
          permMap[p.module_key].allowed_tabs = merged;
        }
      }
      if (p.can_read) permMap[p.module_key].can_read = true;
      if (p.can_edit) permMap[p.module_key].can_edit = true;
      if (p.can_delete) permMap[p.module_key].can_delete = true;
    });

    setModulePermissions(Object.values(permMap));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            await fetchProfile(session.user.id);
            await fetchRoles(session.user.id);
            await fetchDynamicPermissions(session.user.id);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setIsSuperAdmin(false);
          setAssignedRoles([]);
          setModulePermissions([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchRoles(session.user.id),
          fetchDynamicPermissions(session.user.id),
        ]).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setIsSuperAdmin(false);
    setAssignedRoles([]);
    setModulePermissions([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const hasModuleAccess = (moduleKey: string, action: "read" | "edit" | "delete" = "read") => {
    if (isSuperAdmin) return true;
    if (assignedRoles.length === 0) return true;

    const perm = modulePermissions.find((p) => p.module_key === moduleKey);
    if (!perm) return false;

    switch (action) {
      case "read": return perm.can_read;
      case "edit": return perm.can_edit;
      case "delete": return perm.can_delete;
      default: return false;
    }
  };

  const hasTabAccess = (moduleKey: string, tabKey: string) => {
    if (isSuperAdmin) return true;
    if (assignedRoles.length === 0) return true;

    const perm = modulePermissions.find((p) => p.module_key === moduleKey);
    if (!perm) return true;
    if (!perm.allowed_tabs || perm.allowed_tabs.length === 0) return true;
    return perm.allowed_tabs.includes(tabKey);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading,
      isSuperAdmin, assignedRoles, modulePermissions,
      signIn, signUp, signOut, hasRole, hasModuleAccess, hasTabAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
