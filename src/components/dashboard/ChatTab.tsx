import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Inbox } from "lucide-react";
import { useWhatsAppInboxes, useWhatsAppConversations, useWhatsAppMessages } from "@/hooks/useWhatsApp";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ConversationList from "./chat/ConversationList";
import ChatArea from "./chat/ChatArea";

export interface InboxMeta {
  label: string;
  color: string | null;
}

const ChatTab = () => {
  const { inboxes, loading: inboxesLoading } = useWhatsAppInboxes();
  const { pendingChatPhone, pendingChatInboxId, pendingChatContactName, clearPendingChat } = useDashboard();
  const { profile } = useAuth();
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [assignedFilter, setAssignedFilter] = useState<'mine' | 'all'>('all');
  const { conversations, loading: convsLoading, refetch: refetchConversations } = useWhatsAppConversations({
    inboxId: selectedInboxId,
    statusFilter,
    assignedToFilter: assignedFilter,
  });
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const { messages, loading: msgsLoading } = useWhatsAppMessages(selectedConvId);

  const selectedConv = conversations.find(c => c.id === selectedConvId) || null;

  // Build inbox -> { label, color } map from inboxes + google_calendar_accounts
  const { data: inboxCalendarData } = useQuery({
    queryKey: ['inbox-calendar-colors', profile?.clinic_id],
    queryFn: async () => {
      const { data: inboxRows } = await supabase
        .from('whatsapp_inboxes')
        .select('id, label, google_calendar_account_id')
        .order('label');
      if (!inboxRows) return {};

      const calendarIds = inboxRows
        .map((r: any) => r.google_calendar_account_id)
        .filter(Boolean) as string[];

      let colorMap: Record<string, string> = {};
      if (calendarIds.length > 0) {
        const { data: cals } = await supabase
          .from('google_calendar_accounts')
          .select('id, color')
          .in('id', calendarIds);
        if (cals) {
          cals.forEach((c: any) => { colorMap[c.id] = c.color; });
        }
      }

      const result: Record<string, InboxMeta> = {};
      inboxRows.forEach((r: any) => {
        result[r.id] = {
          label: r.label,
          color: r.google_calendar_account_id ? (colorMap[r.google_calendar_account_id] || null) : null,
        };
      });
      return result;
    },
    enabled: !!profile?.clinic_id,
  });

  const inboxMetaMap = inboxCalendarData || {};
  useEffect(() => {
    if (!pendingChatPhone || !pendingChatInboxId || convsLoading) return;

    const handlePending = async () => {
      // Set the inbox filter to match selected inbox
      setSelectedInboxId(pendingChatInboxId);

      const normalizedPhone = pendingChatPhone.replace(/\D/g, "");

      // Wait for conversations to reload with new inbox filter - search across all
      const { data: existingConvs } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('inbox_id', pendingChatInboxId)
        .or(`remote_jid.ilike.%${normalizedPhone}%,contact_phone.ilike.%${normalizedPhone}%`);

      let targetConvId: string | null = null;

      if (existingConvs && existingConvs.length > 0) {
        targetConvId = existingConvs[0].id;
      } else if (profile?.clinic_id) {
        // Create new conversation
        const remoteJid = normalizedPhone.startsWith('55')
          ? `${normalizedPhone}@s.whatsapp.net`
          : `55${normalizedPhone}@s.whatsapp.net`;

        const { data: newConv, error } = await supabase
          .from('whatsapp_conversations')
          .insert({
            clinic_id: profile.clinic_id,
            inbox_id: pendingChatInboxId,
            remote_jid: remoteJid,
            contact_phone: normalizedPhone,
            contact_name: pendingChatContactName || null,
            conversation_status: 'humano',
          } as any)
          .select()
          .single();

        if (!error && newConv) {
          targetConvId = newConv.id;
        }
      }

      if (targetConvId) {
        await refetchConversations();
        setSelectedConvId(targetConvId);
      }
      clearPendingChat();
    };

    handlePending();
  }, [pendingChatPhone, pendingChatInboxId, convsLoading, clearPendingChat, pendingChatContactName, profile?.clinic_id, refetchConversations]);


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
          inboxMetaMap={inboxMetaMap}
          showInboxLabel={!selectedInboxId}
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
