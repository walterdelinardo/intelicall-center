import {
  LayoutDashboard, Calendar, Users, MessageSquare, FileText,
  DollarSign, Package, TrendingUp, Settings, LogOut, Footprints,
  ClipboardList, UserCog, Clock
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AppSidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
}

const mainMenuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "conversas", label: "Conversas", icon: MessageSquare },
  { id: "prontuarios", label: "Prontuários", icon: FileText },
  { id: "procedimentos", label: "Procedimentos", icon: ClipboardList },
  { id: "lista-espera", label: "Lista de Espera", icon: Clock },
];

const financeMenuItems = [
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "estoque", label: "Estoque", icon: Package },
  { id: "leads", label: "Leads & Funil", icon: TrendingUp },
];

const adminMenuItems = [
  { id: "usuarios", label: "Usuários", icon: UserCog },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

const AppSidebar = ({ activeModule, onModuleChange }: AppSidebarProps) => {
  const { profile, assignedRoles, signOut, hasModuleAccess } = useAuth();

  const renderMenuItems = (items: typeof mainMenuItems) =>
    items.filter((item) => hasModuleAccess(item.id, "read")).map((item) => (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          isActive={activeModule === item.id}
          onClick={() => onModuleChange(item.id)}
          tooltip={item.label}
        >
          <item.icon className="w-4 h-4" />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Footprints className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-sidebar-foreground">PodoClinic</span>
            <span className="text-xs text-muted-foreground">Gestão de Podologia</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderMenuItems(mainMenuItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderMenuItems(financeMenuItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Administração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderMenuItems(adminMenuItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">{profile?.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{assignedRoles.map(r => r.name).join(", ") || "Usuário"}</p>
          </div>
          <button onClick={signOut} className="text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
