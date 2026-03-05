import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

const ConfiguracoesModule = () => (
  <Card className="shadow-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" />
        Configurações da Clínica
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">Módulo de configurações será implementado em breve.</p>
    </CardContent>
  </Card>
);

export default ConfiguracoesModule;
