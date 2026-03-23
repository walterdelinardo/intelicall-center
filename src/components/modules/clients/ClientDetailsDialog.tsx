import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, MapPin, Calendar, User, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  birth_date: string | null;
  cpf: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  lead_source: string | null;
  total_visits: number;
  last_visit_at: string | null;
  average_ticket: number;
  is_active: boolean;
  created_at: string;
}

interface Props {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ClientDetailsDialog = ({ client, open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {client.name}
            {!client.is_active && <Badge variant="destructive">Inativo</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Contato</h4>
            {client.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" /> {client.phone}
              </div>
            )}
            {client.whatsapp && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-success" /> {client.whatsapp} (WhatsApp)
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" /> {client.email}
              </div>
            )}
          </div>

          <Separator />

          {/* Info */}
          <div className="grid grid-cols-2 gap-4">
            {client.birth_date && (
              <div>
                <p className="text-xs text-muted-foreground">Nascimento</p>
                <p className="text-sm">{format(new Date(client.birth_date), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
            )}
            {client.cpf && (
              <div>
                <p className="text-xs text-muted-foreground">CPF</p>
                <p className="text-sm">{client.cpf}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Total de Visitas</p>
              <p className="text-sm font-medium">{client.total_visits}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ticket Médio</p>
              <p className="text-sm font-medium">R$ {Number(client.average_ticket).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Última Visita</p>
              <p className="text-sm">
                {client.last_visit_at
                  ? format(new Date(client.last_visit_at), "dd/MM/yyyy", { locale: ptBR })
                  : "Nunca"}
              </p>
            </div>
            {client.lead_source && (
              <div>
                <p className="text-xs text-muted-foreground">Origem</p>
                <Badge variant="secondary">{client.lead_source}</Badge>
              </div>
            )}
          </div>

          {client.address && (
            <>
              <Separator />
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span>{client.address}{(client as any).address_number ? `, ${(client as any).address_number}` : ""}{(client as any).address_complement ? ` - ${(client as any).address_complement}` : ""}{(client as any).neighborhood ? `, ${(client as any).neighborhood}` : ""}{client.city ? `, ${client.city}` : ""}{client.state ? ` - ${client.state}` : ""}</span>
              </div>
            </>
          )}

          {client.notes && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Observações</span>
                </div>
                <p className="text-sm">{client.notes}</p>
              </div>
            </>
          )}

          <Separator />
          <p className="text-xs text-muted-foreground">
            Cadastrado em {format(new Date(client.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailsDialog;
