import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Client {
  nome: string;
  whatsapp: string;
  nome_wpp: string;
  email: string | null;
  "data-nasc": string | null;
}

export const useClients = () => {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<Client[]>("get-clients");
      
      if (error) throw error;
      return data || [];
    },
  });
};
