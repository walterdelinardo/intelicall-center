import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Footprints, Building2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Onboarding = () => {
  const [clinicName, setClinicName] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName) {
      toast.error("Digite o nome da clínica");
      return;
    }
    if (!user) return;

    setIsLoading(true);
    try {
      // Create the clinic
      const { data: clinic, error: clinicError } = await supabase
        .from("clinics")
        .insert({ name: clinicName, phone: clinicPhone, address: clinicAddress })
        .select()
        .single();

      if (clinicError) throw clinicError;

      // Update profile with clinic_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ clinic_id: clinic.id })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Create admin role for the user
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, clinic_id: clinic.id, role: "admin" });

      if (roleError) throw roleError;

      toast.success("Clínica criada com sucesso!");
      // Force reload to refresh auth context
      window.location.href = "/dashboard";
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar clínica");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent to-background p-4">
      <Card className="w-full max-w-lg shadow-lg animate-fade-in">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-card">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Bem-vindo ao PodoClinic!</CardTitle>
          <CardDescription>Configure sua clínica para começar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateClinic} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Nome da Clínica *</Label>
              <Input id="clinic-name" placeholder="Ex: Clínica Podologia Centro" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic-phone">Telefone</Label>
              <Input id="clinic-phone" placeholder="(11) 99999-9999" value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic-address">Endereço</Label>
              <Input id="clinic-address" placeholder="Rua, número, bairro" value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary shadow-card gap-2" disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar Clínica e Continuar"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
