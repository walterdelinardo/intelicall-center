import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCog } from "lucide-react";

const UsuariosModule = () => (
  <Card className="shadow-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <UserCog className="w-5 h-5 text-primary" />
        Gestão de Usuários
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">Módulo de usuários será implementado em breve.</p>
    </CardContent>
  </Card>
);

export default UsuariosModule;
