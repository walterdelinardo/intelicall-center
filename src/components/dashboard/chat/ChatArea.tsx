import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, MessageSquare, Check, CheckCheck, Clock, Image, FileText, Mic, Bot, User, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { WhatsAppConversation, WhatsAppMessage, useSendWhatsAppMessage, useConversationActions } from "@/hooks/useWhatsApp";

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

interface ChatAreaProps {
  conversation: WhatsAppConversation | null;
  messages: WhatsAppMessage[];
  messagesLoading: boolean;
}

const ChatArea = ({ conversation, messages, messagesLoading }: ChatAreaProps) => {
  const { sendMessage, sending } = useSendWhatsAppMessage();
  const { assumeConversation, returnToBot, closeConversation, markAsRead } = useConversationActions();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when opening conversation
  useEffect(() => {
    if (conversation && conversation.unread_count > 0) {
      markAsRead(conversation.id).catch(console.error);
    }
  }, [conversation?.id]);

  const handleSend = async () => {
    if (!message.trim() || !conversation) return;
    try {
      await sendMessage(conversation.remote_jid, message, conversation.inbox_id);
      setMessage("");
    } catch {
      toast.error("Erro ao enviar mensagem");
    }
  };

  const handleAssume = async () => {
    if (!conversation) return;
    try {
      await assumeConversation(conversation.id);
      toast.success("Conversa assumida");
    } catch {
      toast.error("Erro ao assumir conversa");
    }
  };

  const handleReturnToBot = async () => {
    if (!conversation) return;
    try {
      await returnToBot(conversation.id);
      toast.success("Devolvida ao bot");
    } catch {
      toast.error("Erro ao devolver ao bot");
    }
  };

  const handleClose = async () => {
    if (!conversation) return;
    try {
      await closeConversation(conversation.id);
      toast.success("Conversa encerrada");
    } catch {
      toast.error("Erro ao encerrar");
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <MessageSquare className="w-12 h-12 opacity-30" />
        <p className="text-sm">Selecione uma conversa para começar</p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-3">
        <Avatar className="w-9 h-9">
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {(conversation.contact_name || conversation.contact_phone || '?')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">
            {conversation.contact_name || conversation.contact_phone || 'Desconhecido'}
          </h4>
          {conversation.contact_phone && (
            <p className="text-xs text-muted-foreground">+{conversation.contact_phone}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {conversation.conversation_status !== 'humano' && (
            <Button variant="outline" size="sm" onClick={handleAssume} className="text-xs h-7 gap-1">
              <User className="w-3 h-3" /> Assumir
            </Button>
          )}
          {conversation.conversation_status === 'humano' && (
            <Button variant="outline" size="sm" onClick={handleReturnToBot} className="text-xs h-7 gap-1">
              <Bot className="w-3 h-3" /> Devolver ao Bot
            </Button>
          )}
          {conversation.conversation_status !== 'encerrado' && (
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs h-7 gap-1 text-destructive hover:text-destructive">
              <XCircle className="w-3 h-3" /> Encerrar
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Nenhuma mensagem ainda</div>
        ) : (
          <div className="space-y-2">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  msg.is_from_me
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                }`}>
                  {msg.message_type !== 'text' && (
                    <div className="flex items-center gap-1 mb-1 opacity-70">
                      <MessageTypeIcon type={msg.message_type} />
                      <span className="text-[10px] uppercase">{msg.message_type}</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[10px] opacity-60">{format(new Date(msg.timestamp), 'HH:mm')}</span>
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
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Digite sua mensagem..."
            className="flex-1"
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={!message.trim() || sending} size="icon" className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
};

export default ChatArea;
