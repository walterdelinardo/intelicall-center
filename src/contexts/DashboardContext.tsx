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

  return (
    <DashboardContext.Provider value={{
      activeModule, setActiveModule,
      pendingChatPhone, pendingChatInboxId, pendingChatContactName,
      clearPendingChat, openChatWithPhone,
      showInboxPicker, confirmChatWithInbox, cancelInboxPicker,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};
