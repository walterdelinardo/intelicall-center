import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, User, Bot, UserCheck, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useChatwootConversations } from "@/hooks/useChatwootConversations";
import { format } from "date-fns";

interface Message {
  id: number;
  type: "user" | "bot";
  text: string;
  timestamp: string;
  sender: string;
}

const ChatTab = () => {
  const { conversations: chatwootConversations, loading } = useChatwootConversations();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSendMessage = () => {
    if (message.trim()) {
      const newMessage: Message = {
        id: messages.length + 1,
        type: "bot",
        text: message,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        sender: "Você",
      };
      setMessages([...messages, newMessage]);
      setMessage("");
    }
  };

  const handleTakeOver = () => {
    toast.success("Você assumiu a conversa!");
  };

  const handleSendToWhatsApp = async () => {
    if (!selectedChat) return;
    
    const conv = chatwootConversations.find(c => c.id === selectedChat);
    if (!conv || !conv.contact_phone) {
      toast.error("Número de telefone não encontrado");
      return;
    }

    try {
      toast.loading("Enviando mensagem para WhatsApp...");
      
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phoneNumber: conv.contact_phone,
          message: message || 'Nova mensagem via dashboard'
        }
      });

      if (error) throw error;

      toast.success("Mensagem enviada para WhatsApp!");
      setMessage("");
    } catch (error) {
      console.error('Error sending to WhatsApp:', error);
      toast.error("Erro ao enviar para WhatsApp");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de conversas */}
      <Card className="lg:col-span-1 p-4 shadow-card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Conversas Ativas
        </h3>
        <ScrollArea className="h-[600px]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Carregando conversas...</p>
            </div>
          ) : chatwootConversations.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chatwootConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedChat(conv.id)}
                  className={`w-full p-3 rounded-lg text-left transition-smooth hover:bg-accent ${
                    selectedChat === conv.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{conv.contact_name?.[0] || 'C'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">{conv.contact_name || 'Contato'}</span>
                        <span className="text-xs text-muted-foreground">
                          {conv.last_message_at ? format(new Date(conv.last_message_at), 'HH:mm') : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message || 'Sem mensagens'}</p>
                      <Badge 
                        variant="outline" 
                        className={`mt-1 text-xs ${
                          conv.status === 'open' 
                            ? 'bg-success/10 text-success border-success/20' 
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {conv.status === 'open' ? 'Aberta' : conv.status === 'resolved' ? 'Resolvida' : conv.status}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Área de chat */}
      <Card className="lg:col-span-2 flex flex-col shadow-card">
        {selectedChat ? (
          <>
            {/* Header do chat */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {chatwootConversations.find(c => c.id === selectedChat)?.contact_name?.[0] || 'C'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold">
                    {chatwootConversations.find(c => c.id === selectedChat)?.contact_name || 'Contato'}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {chatwootConversations.find(c => c.id === selectedChat)?.contact_phone || 
                     chatwootConversations.find(c => c.id === selectedChat)?.contact_email || ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSendToWhatsApp} variant="outline" size="sm" className="gap-2">
                  <Phone className="w-4 h-4" />
                  Enviar via WhatsApp
                </Button>
                <Button onClick={handleTakeOver} variant="outline" size="sm" className="gap-2">
                  <UserCheck className="w-4 h-4" />
                  Assumir Conversa
                </Button>
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4 h-[450px]">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 animate-fade-in ${
                      msg.type === "bot" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.type === "user" && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        msg.type === "user"
                          ? "bg-chat-bubble-bot text-chat-bubble-bot-foreground"
                          : "bg-chat-bubble-user text-chat-bubble-user-foreground"
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <span className="text-xs opacity-70 mt-1 block">{msg.timestamp}</span>
                    </div>
                    {msg.type === "bot" && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input de mensagem */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Digite sua mensagem..."
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} className="bg-gradient-primary">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Selecione uma conversa para começar</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChatTab;
