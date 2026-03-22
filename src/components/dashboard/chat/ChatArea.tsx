import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, MessageSquare, Bot, User, EyeOff, Eye, Paperclip, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppConversation, WhatsAppMessage, useSendWhatsAppMessage, useConversationActions } from "@/hooks/useWhatsApp";
import MessageBubble from "./MessageBubble";
import { isToday, isYesterday, isSameDay, format } from "date-fns";

const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM/yyyy");
};

const DateSeparator = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 my-3">
    <div className="flex-1 h-px bg-border" />
    <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-0.5 rounded-full whitespace-nowrap">
      {label}
    </span>
    <div className="flex-1 h-px bg-border" />
  </div>
);
interface ChatAreaProps {
  conversation: WhatsAppConversation | null;
  messages: WhatsAppMessage[];
  messagesLoading: boolean;
}

const ChatArea = ({ conversation, messages, messagesLoading }: ChatAreaProps) => {
  const { sendMessage, sendInternalNote, sending } = useSendWhatsAppMessage();
  const { assumeConversation, returnToBot, hideConversation, unhideConversation, markAsRead } = useConversationActions();
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (conversation && conversation.unread_count > 0) {
      markAsRead(conversation.id).catch(console.error);
    }
  }, [conversation?.id]);

  const handleSend = async () => {
    if (!message.trim() || !conversation) return;
    try {
      if (isNoteMode) {
        await sendInternalNote(conversation.id, message);
      } else {
        await sendMessage(conversation.remote_jid, message, conversation.inbox_id);
      }
      setMessage("");
    } catch {
      toast.error(isNoteMode ? "Erro ao salvar nota" : "Erro ao enviar mensagem");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${conversation.clinic_id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(path);

      const mediaUrl = urlData.publicUrl;
      const isImage = file.type.startsWith('image/');
      const isAudio = file.type.startsWith('audio/');
      const messageType = isImage ? 'image' : isAudio ? 'audio' : 'document';
      const caption = message.trim() || file.name;

      await sendMessage(conversation.remote_jid, caption, conversation.inbox_id, messageType, mediaUrl);
      setMessage("");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAssume = async () => {
    if (!conversation) return;
    try { await assumeConversation(conversation.id); toast.success("Conversa assumida"); }
    catch { toast.error("Erro ao assumir conversa"); }
  };

  const handleReturnToBot = async () => {
    if (!conversation) return;
    try { await returnToBot(conversation.id); toast.success("Devolvida ao bot"); }
    catch { toast.error("Erro ao devolver ao bot"); }
  };

  const handleClose = async () => {
    if (!conversation) return;
    try { await closeConversation(conversation.id); toast.success("Conversa encerrada"); }
    catch { toast.error("Erro ao encerrar"); }
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
            {messages.map((msg, idx) => {
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showDate = !prevMsg || !isSameDay(new Date(msg.timestamp), new Date(prevMsg.timestamp));
              return (
                <div key={msg.id}>
                  {showDate && <DateSeparator label={formatDateLabel(msg.timestamp)} />}
                  <MessageBubble msg={msg} />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className={`p-3 border-t ${isNoteMode ? 'bg-yellow-50 dark:bg-yellow-950/20 border-t-yellow-300 dark:border-t-yellow-700' : ''}`}>
        {isNoteMode && (
          <div className="flex items-center gap-1.5 mb-2 text-yellow-700 dark:text-yellow-400">
            <StickyNote className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Nota interna — não será enviada ao cliente</span>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileUpload}
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading || isNoteMode}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`shrink-0 ${isNoteMode ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/60' : ''}`}
            onClick={() => setIsNoteMode(!isNoteMode)}
            title={isNoteMode ? 'Modo mensagem' : 'Modo nota interna'}
          >
            {isNoteMode ? <StickyNote className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </Button>
          <Input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isNoteMode ? "Escreva uma nota interna..." : "Digite sua mensagem..."}
            className={`flex-1 ${isNoteMode ? 'border-yellow-300 dark:border-yellow-700 focus-visible:ring-yellow-400' : ''}`}
            disabled={sending || uploading}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending || uploading}
            size="icon"
            className={`shrink-0 ${isNoteMode ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
};

export default ChatArea;
