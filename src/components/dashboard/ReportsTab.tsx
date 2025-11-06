import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, TrendingUp, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const ReportsTab = () => {
  const stats = [
    {
      title: "Total de Clientes",
      value: "1,234",
      change: "+12%",
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Atendimentos Hoje",
      value: "48",
      change: "+8%",
      icon: MessageSquare,
      color: "text-success",
    },
    {
      title: "Taxa de Conversão",
      value: "68%",
      change: "+5%",
      icon: TrendingUp,
      color: "text-warning",
    },
    {
      title: "Tempo Médio",
      value: "4.2min",
      change: "-2%",
      icon: Clock,
      color: "text-accent-foreground",
    },
  ];

  const chartData = [
    { name: "Seg", atendimentos: 32, vendas: 18 },
    { name: "Ter", atendimentos: 45, vendas: 24 },
    { name: "Qua", atendimentos: 38, vendas: 20 },
    { name: "Qui", atendimentos: 52, vendas: 28 },
    { name: "Sex", atendimentos: 48, vendas: 32 },
    { name: "Sáb", atendimentos: 25, vendas: 12 },
    { name: "Dom", atendimentos: 15, vendas: 8 },
  ];

  return (
    <div className="space-y-6">
      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-card hover:shadow-lg transition-smooth animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-bold">{stat.value}</h3>
                  <p className={`text-xs mt-1 ${stat.change.startsWith("+") ? "text-success" : "text-destructive"}`}>
                    {stat.change} vs. semana anterior
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Atendimentos por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Bar dataKey="atendimentos" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Vendas Semanais</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="vendas"
                  stroke="hsl(var(--success))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--success))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsTab;
