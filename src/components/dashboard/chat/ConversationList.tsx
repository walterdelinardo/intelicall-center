import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Bot, User, Clock, EyeOff } from "lucide-react";
import { format, isToday } from "date-fns";
import { WhatsAppConversation } from "@/hooks/useWhatsApp";
import { type InboxMeta } from "@/components/dashboard/ChatTab";
import { useState } from "react";

const StatusIndicator = ({ status }: { status: string }) => {
  const config: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    bot: { icon: <Bot className="w-3 h-3" />, color: "bg-blue-500", label: "Bot" },
    humano: { icon: <User className="w-3 h-3" />, color: "bg-emerald-500", label: "Humano" },
    aguardando_cliente: { icon: <Clock className="w-3 h-3" />, color: "bg-amber-500", label: "Aguardando" },
    encerrado: { icon: <EyeOff className="w-3 h-3" />, color: "bg-muted-foreground", label: "Oculto" },
  };
  const c = config[status] || config.bot;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] text-white px-1.5 py-0.5 rounded-full ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
};

interface ConversationListProps {
  conversations: WhatsAppConversation[];
  loading: boolean;
  selectedConvId: string | null;
  onSelect: (id: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
  assignedFilter: 'mine' | 'all';
  onAssignedFilterChange: (value: 'mine' | 'all') => void;
  inboxMetaMap?: Record<string, InboxMeta>;
  showInboxLabel?: boolean;
}

const ConversationList = ({
  conversations, loading, selectedConvId, onSelect,
  statusFilter, onStatusFilterChange,
  assignedFilter, onAssignedFilterChange,
  inboxMetaMap = {},
  showInboxLabel = false,
}: ConversationListProps) => {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.display_name || '').toLowerCase().includes(q) ||
      (c.contact_name || '').toLowerCase().includes(q) ||
      (c.contact_phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full min-w-0 min-h-0 overflow-hidden">
      <div className="p-2 sm:p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter || "todos"} onValueChange={v => onStatusFilterChange(v === "todos" ? null : v)}>
            <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="bot">Bot</SelectItem>
              <SelectItem value="humano">Humano</SelectItem>
              <SelectItem value="aguardando_cliente">Aguardando</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assignedFilter} onValueChange={v => onAssignedFilterChange(v as 'mine' | 'all')}>
            <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="mine">Meus</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 min-w-0">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            {search ? 'Nenhum resultado' : 'Nenhuma conversa'}
          </div>
        ) : (
          <div className="p-1.5 pr-3 sm:p-2 sm:pr-4 space-y-1">
            {filtered.map(conv => {
              const meta = conv.inbox_id ? inboxMetaMap[conv.inbox_id] : null;
              const inboxColor = meta?.color || null;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full rounded-lg p-2 sm:p-2.5 text-left transition-colors hover:bg-accent/50 overflow-hidden ${
                    selectedConvId === conv.id ? "bg-accent" : ""
                  }`}
                  style={inboxColor ? { borderLeft: `3px solid ${inboxColor}` } : undefined}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <Avatar className="w-9 h-9 sm:w-10 sm:h-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {(conv.display_name || conv.contact_name || conv.contact_phone || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-medium text-sm truncate min-w-0 flex-1">
                          {conv.display_name || conv.contact_name || conv.contact_phone || 'Desconhecido'}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {conv.last_message_at
                            ? isToday(new Date(conv.last_message_at))
                              ? format(new Date(conv.last_message_at), 'HH:mm')
                              : format(new Date(conv.last_message_at), 'dd/MM/yyyy')
                            : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate min-w-0">
                        {conv.last_message || 'Sem mensagens'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <StatusIndicator status={conv.conversation_status} />
                        {showInboxLabel && meta && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            {inboxColor && (
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: inboxColor }} />
                            )}
                            {meta.label}
                          </span>
                        )}
                        {conv.unread_count > 0 && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ConversationList;
