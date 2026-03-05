import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

const ProcedimentosModule = () => (
  <Card className="shadow-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-primary" />
        Catálogo de Procedimentos
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">Módulo de procedimentos será implementado na Fase 2.</p>
    </CardContent>
  </Card>
);

export default ProcedimentosModule;
