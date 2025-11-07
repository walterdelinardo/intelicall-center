import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/useClients";
import { User, Phone, Mail, Calendar, Search } from "lucide-react";

const ClientsTab = () => {
  const { data: clients, isLoading, error } = useClients();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!searchTerm.trim()) return clients;

    const search = searchTerm.toLowerCase().trim();
    return clients.filter((client) => {
      return (
        client.nome?.toLowerCase().includes(search) ||
        client.whatsapp?.toLowerCase().includes(search) ||
        client.email?.toLowerCase().includes(search) ||
        client.nome_wpp?.toLowerCase().includes(search)
      );
    });
  }, [clients, searchTerm]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Erro ao carregar clientes</CardTitle>
          <CardDescription className="text-destructive">
            {error instanceof Error ? error.message : "Erro desconhecido"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-muted-foreground">
            {searchTerm ? (
              <>
                {filteredClients.length} de {clients?.length || 0} clientes
              </>
            ) : (
              <>Total de {clients?.length || 0} clientes cadastrados</>
            )}
          </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nome, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredClients?.map((client, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{client.nome}</CardTitle>
                    {client.nome_wpp && client.nome_wpp !== client.nome && (
                      <CardDescription className="text-xs">
                        WhatsApp: {client.nome_wpp}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{client.whatsapp}</span>
              </div>
              
              {client.email ? (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground truncate">{client.email}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="italic">Sem email</span>
                </div>
              )}

              {client["data-nasc"] ? (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{client["data-nasc"]}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span className="italic">Data não informada</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClients?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">
              {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </p>
            <p className="text-sm text-muted-foreground">
              {searchTerm
                ? "Tente buscar com outros termos"
                : "Os clientes do banco de dados aparecerão aqui"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientsTab;
