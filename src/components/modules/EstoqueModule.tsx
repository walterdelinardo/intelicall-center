import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

const EstoqueModule = () => (
  <Card className="shadow-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Package className="w-5 h-5 text-primary" />
        Controle de Estoque
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">Módulo de estoque será implementado na Fase 4.</p>
    </CardContent>
  </Card>
);

export default EstoqueModule;
