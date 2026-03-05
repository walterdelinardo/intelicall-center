import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

const ClientesModule = () => (
  <Card className="shadow-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        Clientes (CRM)
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">Módulo de clientes será implementado na Fase 2.</p>
    </CardContent>
  </Card>
);

export default ClientesModule;
