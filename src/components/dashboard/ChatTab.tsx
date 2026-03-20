import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Inbox } from "lucide-react";
import { useWhatsAppInboxes, useWhatsAppConversations, useWhatsAppMessages } from "@/hooks/useWhatsApp";
import { useDashboard } from "@/contexts/DashboardContext";
import ConversationList from "./chat/ConversationList";
import ChatArea from "./chat/ChatArea";

const ChatTab = () => {
  const { inboxes, loading: inboxesLoading } = useWhatsAppInboxes();
  const { pendingChatPhone, clearPendingChat } = useDashboard();
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [assignedFilter, setAssignedFilter] = useState<'mine' | 'all'>('all');
  const { conversations, loading: convsLoading } = useWhatsAppConversations({
    inboxId: selectedInboxId,
    statusFilter,
    assignedToFilter: assignedFilter,
  });
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const { messages, loading: msgsLoading } = useWhatsAppMessages(selectedConvId);

  const selectedConv = conversations.find(c => c.id === selectedConvId) || null;

  // Auto-select conversation when navigating from another module
  useEffect(() => {
    if (!pendingChatPhone || convsLoading || conversations.length === 0) return;
    const normalizedPhone = pendingChatPhone.replace(/\D/g, "");
    const match = conversations.find(c => {
      const jid = c.remote_jid?.replace(/\D/g, "") || "";
      const phone = c.contact_phone?.replace(/\D/g, "") || "";
      return jid.includes(normalizedPhone) || phone.includes(normalizedPhone) || normalizedPhone.includes(phone);
    });
    if (match) {
      setSelectedConvId(match.id);
    }
    clearPendingChat();
  }, [pendingChatPhone, conversations, convsLoading, clearPendingChat]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
      <Card className="lg:col-span-1 flex flex-col shadow-card overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <MessageSquare className="w-4 h-4 text-primary" />
            WhatsApp
          </h3>
          {inboxes.length > 0 && (
            <Select
              value={selectedInboxId || "all"}
              onValueChange={v => {
                setSelectedInboxId(v === "all" ? null : v);
                setSelectedConvId(null);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <Inbox className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Todas as caixas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as caixas</SelectItem>
                {inboxes.map(inbox => (
                  <SelectItem key={inbox.id} value={inbox.id}>
                    {inbox.label} {inbox.phone_number ? `(${inbox.phone_number})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <ConversationList
          conversations={conversations}
          loading={inboxesLoading || convsLoading}
          selectedConvId={selectedConvId}
          onSelect={setSelectedConvId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          assignedFilter={assignedFilter}
          onAssignedFilterChange={setAssignedFilter}
        />
      </Card>

      <Card className="lg:col-span-2 flex flex-col shadow-card overflow-hidden">
        <ChatArea
          conversation={selectedConv}
          messages={messages}
          messagesLoading={msgsLoading}
        />
      </Card>
    </div>
  );
};

export default ChatTab;
