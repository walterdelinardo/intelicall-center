import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/dashboard/AppSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardHome from "@/components/modules/DashboardHome";
import AgendaModule from "@/components/modules/AgendaModule";
import ClientesModule from "@/components/modules/ClientesModule";
import ConversasModule from "@/components/modules/ConversasModule";
import ProntuariosModule from "@/components/modules/ProntuariosModule";
import ProcedimentosModule from "@/components/modules/ProcedimentosModule";
import FinanceiroModule from "@/components/modules/FinanceiroModule";
import EstoqueModule from "@/components/modules/EstoqueModule";
import LeadsModule from "@/components/modules/LeadsModule";
import UsuariosModule from "@/components/modules/UsuariosModule";
import ConfiguracoesModule from "@/components/modules/ConfiguracoesModule";
import ListaEsperaModule from "@/components/modules/ListaEsperaModule";
import InboxPickerDialog from "@/components/dashboard/InboxPickerDialog";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";

const modules: Record<string, React.ComponentType> = {
  dashboard: DashboardHome,
  agenda: AgendaModule,
  clientes: ClientesModule,
  conversas: ConversasModule,
  prontuarios: ProntuariosModule,
  procedimentos: ProcedimentosModule,
  financeiro: FinanceiroModule,
  estoque: EstoqueModule,
  leads: LeadsModule,
  usuarios: UsuariosModule,
  configuracoes: ConfiguracoesModule,
  "lista-espera": ListaEsperaModule,
};

const DashboardContent = () => {
  const { activeModule, setActiveModule } = useDashboard();
  const ActiveComponent = modules[activeModule] || DashboardHome;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar activeModule={activeModule} onModuleChange={setActiveModule} />
        <div className="flex-1 flex flex-col overflow-auto min-w-0">
          <DashboardHeader />
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold text-foreground capitalize">{activeModule === "dashboard" ? "Painel" : activeModule}</h1>
          </div>
          <main className="flex-1 p-6 animate-fade-in min-w-0">
            <ActiveComponent />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

const Dashboard = () => (
  <DashboardProvider>
    <DashboardContent />
    <InboxPickerDialog />
  </DashboardProvider>
);

export default Dashboard;
