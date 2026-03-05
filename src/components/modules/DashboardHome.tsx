import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, DollarSign, TrendingUp, Clock, UserPlus } from "lucide-react";

const stats = [
  { label: "Agendamentos Hoje", value: "0", icon: Calendar, color: "text-primary" },
  { label: "Faturamento Hoje", value: "R$ 0,00", icon: DollarSign, color: "text-success" },
  { label: "Novos Clientes", value: "0", icon: UserPlus, color: "text-accent-foreground" },
  { label: "Leads do Mês", value: "0", icon: TrendingUp, color: "text-warning" },
  { label: "Taxa de Retorno", value: "0%", icon: Users, color: "text-primary" },
  { label: "Próx. Atendimento", value: "--:--", icon: Clock, color: "text-muted-foreground" },
];

const DashboardHome = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-card hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Agendamentos de Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Nenhum agendamento para hoje.</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Últimas Conversas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Nenhuma conversa recente.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;
