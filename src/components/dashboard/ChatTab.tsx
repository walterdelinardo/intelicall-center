import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Check, CheckCheck, Clock, Phone, Image, FileText, Mic } from "lucide-react";
import { toast } from "sonner";
import { useWhatsAppConversations, useWhatsAppMessages, useSendWhatsAppMessage } from "@/hooks/useWhatsApp";
import { format } from "date-fns";

const MessageStatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'read': return <CheckCheck className="w-3 h-3 text-blue-500" />;
    case 'delivered': return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
    case 'sent': return <Check className="w-3 h-3 text-muted-foreground" />;
    default: return <Clock className="w-3 h-3 text-muted-foreground" />;
  }
};

const MessageTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'image': return <Image className="w-4 h-4" />;
    case 'audio': return <Mic className="w-4 h-4" />;
    case 'document': return <FileText className="w-4 h-4" />;
    default: return null;
  }
};

const ChatTab = () => {
  const { conversations, loading } = useWhatsAppConversations();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const { messages, loading: messagesLoading } = useWhatsAppMessages(selectedConvId);
  const { sendMessage, sending } = useSendWhatsAppMessage();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !selectedConv) return;
    try {
      await sendMessage(selectedConv.remote_jid, message);
      setMessage("");
    } catch {
      toast.error("Erro ao enviar mensagem");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
      {/* Conversation List */}
      <Card className="lg:col-span-1 flex flex-col shadow-card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            WhatsApp
          </h3>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm px-4 text-center">
              <Phone className="w-8 h-8 mb-2 opacity-50" />
              <p>Nenhuma conversa ainda.</p>
              <p className="text-xs mt-1">Configure o webhook do N8N para receber mensagens.</p>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full p-3 text-left transition-colors hover:bg-accent/50 ${
                    selectedConvId === conv.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {(conv.contact_name || conv.contact_phone || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-sm truncate">
                          {conv.contact_name || conv.contact_phone || 'Desconhecido'}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {conv.last_message_at ? format(new Date(conv.last_message_at), 'HH:mm') : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate pr-2">
                          {conv.last_message || 'Sem mensagens'}
                        </p>
                        {conv.unread_count > 0 && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full shrink-0">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Chat Area */}
      <Card className="lg:col-span-2 flex flex-col shadow-card overflow-hidden">
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="p-4 border-b flex items-center gap-3">
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {(selectedConv.contact_name || selectedConv.contact_phone || '?')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">
                  {selectedConv.contact_name || selectedConv.contact_phone || 'Desconhecido'}
                </h4>
                {selectedConv.contact_phone && (
                  <p className="text-xs text-muted-foreground">+{selectedConv.contact_phone}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nenhuma mensagem ainda
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                          msg.is_from_me
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted rounded-bl-sm'
                        }`}
                      >
                        {msg.message_type !== 'text' && (
                          <div className="flex items-center gap-1 mb-1 opacity-70">
                            <MessageTypeIcon type={msg.message_type} />
                            <span className="text-[10px] uppercase">{msg.message_type}</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] opacity-60">
                            {format(new Date(msg.timestamp), 'HH:mm')}
                          </span>
                          {msg.is_from_me && <MessageStatusIcon status={msg.status} />}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Digite sua mensagem..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  size="icon"
                  className="shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <MessageSquare className="w-12 h-12 opacity-30" />
            <p className="text-sm">Selecione uma conversa para começar</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChatTab;
