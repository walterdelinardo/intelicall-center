import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface DashboardContextType {
  activeModule: string;
  setActiveModule: (module: string) => void;
  pendingChatPhone: string | null;
  clearPendingChat: () => void;
  openChatWithPhone: (phone: string) => void;
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

  const openChatWithPhone = useCallback((phone: string) => {
    setPendingChatPhone(phone.replace(/\D/g, ""));
    setActiveModule("conversas");
  }, []);

  const clearPendingChat = useCallback(() => setPendingChatPhone(null), []);

  return (
    <DashboardContext.Provider value={{ activeModule, setActiveModule, pendingChatPhone, clearPendingChat, openChatWithPhone }}>
      {children}
    </DashboardContext.Provider>
  );
};
