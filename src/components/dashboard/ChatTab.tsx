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

interface Message {
  id: number;
  type: "user" | "bot";
  text: string;
  timestamp: string;
  sender: string;
}

const ChatTab = () => {
  const [selectedChat, setSelectedChat] = useState<number | null>(1);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "user",
      text: "Olá, gostaria de agendar uma consulta",
      timestamp: "14:30",
      sender: "João Silva",
    },
    {
      id: 2,
      type: "bot",
      text: "Olá! Claro, terei prazer em ajudar. Qual seria o melhor dia para você?",
      timestamp: "14:31",
      sender: "Assistente",
    },
    {
      id: 3,
      type: "user",
      text: "Prefiro na próxima terça-feira pela manhã",
      timestamp: "14:32",
      sender: "João Silva",
    },
  ]);

  const conversations = [
    { id: 1, name: "João Silva", lastMessage: "Prefiro na próxima terça...", time: "14:32", unread: 2, active: true },
    { id: 2, name: "Maria Santos", lastMessage: "Obrigada pelo atendimento!", time: "13:15", unread: 0, active: false },
    { id: 3, name: "Pedro Costa", lastMessage: "Quando posso buscar?", time: "11:20", unread: 1, active: true },
  ];

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
    
    const conv = conversations.find(c => c.id === selectedChat);
    if (!conv) return;

    try {
      toast.loading("Enviando mensagem para WhatsApp...");
      
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phoneNumber: '5511979987046', // Número configurado no N8N
          message: `Nova mensagem de ${conv.name}: ${message || 'Sem mensagem'}`
        }
      });

      if (error) throw error;

      toast.success("Mensagem enviada para WhatsApp!");
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
          <div className="space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedChat(conv.id)}
                className={`w-full p-3 rounded-lg text-left transition-smooth hover:bg-accent ${
                  selectedChat === conv.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>{conv.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm truncate">{conv.name}</span>
                      <span className="text-xs text-muted-foreground">{conv.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    {conv.active && (
                      <Badge variant="outline" className="mt-1 text-xs bg-success/10 text-success border-success/20">
                        Bot Ativo
                      </Badge>
                    )}
                  </div>
                  {conv.unread > 0 && (
                    <Badge className="bg-primary">{conv.unread}</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
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
                  <AvatarFallback>J</AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold">João Silva</h4>
                  <p className="text-xs text-muted-foreground">Online</p>
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
