import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Smartphone } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";
import { useWhatsAppInboxes } from "@/hooks/useWhatsApp";

const InboxPickerDialog = () => {
  const { showInboxPicker, confirmChatWithInbox, cancelInboxPicker } = useDashboard();
  const { inboxes, loading } = useWhatsAppInboxes(true);

  return (
    <Dialog open={showInboxPicker} onOpenChange={(open) => { if (!open) cancelInboxPicker(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Selecionar instância
          </DialogTitle>
          <DialogDescription>
            Escolha por qual número deseja iniciar a conversa
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : inboxes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma instância ativa encontrada</p>
          ) : (
            inboxes.map((inbox) => (
              <Button
                key={inbox.id}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => confirmChatWithInbox(inbox.id)}
              >
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{inbox.label}</div>
                  {inbox.phone_number && (
                    <div className="text-xs text-muted-foreground">{inbox.phone_number}</div>
                  )}
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InboxPickerDialog;
