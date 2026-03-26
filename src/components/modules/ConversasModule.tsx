import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Bot } from "lucide-react";
import ChatTab from "@/components/dashboard/ChatTab";
import TelegramNotificationsTab from "@/components/modules/conversas/TelegramNotificationsTab";

const ConversasModule = () => {
  return (
    <Tabs defaultValue="whatsapp" className="h-full flex flex-col">
      <TabsList className="w-fit">
        <TabsTrigger value="whatsapp" className="flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4" />
          WhatsApp
        </TabsTrigger>
        <TabsTrigger value="telegram" className="flex items-center gap-1.5">
          <Bot className="w-4 h-4" />
          Notificações Telegram
        </TabsTrigger>
      </TabsList>
      <TabsContent value="whatsapp" className="flex-1 min-h-0 mt-4">
        <ChatTab />
      </TabsContent>
      <TabsContent value="telegram" className="flex-1 min-h-0 mt-4">
        <TelegramNotificationsTab />
      </TabsContent>
    </Tabs>
  );
};

export default ConversasModule;
