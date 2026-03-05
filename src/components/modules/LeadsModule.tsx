import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

const LeadsModule = () => (
  <Card className="shadow-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Leads & Funil de Vendas
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">Módulo de leads será implementado na Fase 6.</p>
    </CardContent>
  </Card>
);

export default LeadsModule;
