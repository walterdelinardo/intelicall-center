import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface DashboardContextType {
  activeModule: string;
  setActiveModule: (module: string) => void;
  pendingChatPhone: string | null;
  pendingChatInboxId: string | null;
  pendingChatContactName: string | null;
  clearPendingChat: () => void;
  openChatWithPhone: (phone: string, contactName?: string) => void;
  showInboxPicker: boolean;
  confirmChatWithInbox: (inboxId: string) => void;
  cancelInboxPicker: () => void;
  pendingProntuarioClientId: string | null;
  openProntuario: (clientId: string) => void;
  clearPendingProntuario: () => void;
  pendingConversasTab: string | null;
  openConversasTab: (tab: string) => void;
  clearPendingConversasTab: () => void;
  pendingAgendaTab: string | null;
  openAgendaTab: (tab: string) => void;
  clearPendingAgendaTab: () => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
};

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [pendingChatPhone, setPendingChatPhone] = useState<string | null>(null);
  const [pendingChatInboxId, setPendingChatInboxId] = useState<string | null>(null);
  const [pendingChatContactName, setPendingChatContactName] = useState<string | null>(null);
  const [showInboxPicker, setShowInboxPicker] = useState(false);
  const [pickerPhone, setPickerPhone] = useState<string | null>(null);
  const [pickerContactName, setPickerContactName] = useState<string | null>(null);
  const [pendingProntuarioClientId, setPendingProntuarioClientId] = useState<string | null>(null);
  const [pendingConversasTab, setPendingConversasTab] = useState<string | null>(null);
  const [pendingAgendaTab, setPendingAgendaTab] = useState<string | null>(null);

  const openChatWithPhone = useCallback((phone: string, contactName?: string) => {
    setPickerPhone(phone.replace(/\D/g, ""));
    setPickerContactName(contactName || null);
    setShowInboxPicker(true);
  }, []);

  const confirmChatWithInbox = useCallback((inboxId: string) => {
    setPendingChatPhone(pickerPhone);
    setPendingChatInboxId(inboxId);
    setPendingChatContactName(pickerContactName);
    setShowInboxPicker(false);
    setPickerPhone(null);
    setPickerContactName(null);
    setActiveModule("conversas");
  }, [pickerPhone, pickerContactName]);

  const cancelInboxPicker = useCallback(() => {
    setShowInboxPicker(false);
    setPickerPhone(null);
    setPickerContactName(null);
  }, []);

  const clearPendingChat = useCallback(() => {
    setPendingChatPhone(null);
    setPendingChatInboxId(null);
    setPendingChatContactName(null);
  }, []);

  const openProntuario = useCallback((clientId: string) => {
    setPendingProntuarioClientId(clientId);
    setActiveModule("prontuarios");
  }, []);

  const clearPendingProntuario = useCallback(() => {
    setPendingProntuarioClientId(null);
  }, []);

  const openConversasTab = useCallback((tab: string) => {
    setPendingConversasTab(tab);
    setActiveModule("conversas");
  }, []);

  const clearPendingConversasTab = useCallback(() => {
    setPendingConversasTab(null);
  }, []);

  const openAgendaTab = useCallback((tab: string) => {
    setPendingAgendaTab(tab);
    setActiveModule("agenda");
  }, []);

  const clearPendingAgendaTab = useCallback(() => {
    setPendingAgendaTab(null);
  }, []);

  return (
    <DashboardContext.Provider value={{
      activeModule, setActiveModule,
      pendingChatPhone, pendingChatInboxId, pendingChatContactName,
      clearPendingChat, openChatWithPhone,
      showInboxPicker, confirmChatWithInbox, cancelInboxPicker,
      pendingProntuarioClientId, openProntuario, clearPendingProntuario,
      pendingConversasTab, openConversasTab, clearPendingConversasTab,
      pendingAgendaTab, openAgendaTab, clearPendingAgendaTab,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};
