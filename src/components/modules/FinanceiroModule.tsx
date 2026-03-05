import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

const FinanceiroModule = () => (
  <Card className="shadow-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        Financeiro / Caixa
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">Módulo financeiro será implementado na Fase 4.</p>
    </CardContent>
  </Card>
);

export default FinanceiroModule;
