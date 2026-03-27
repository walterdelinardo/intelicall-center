import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground">Carregando...</div>
  </div>
);

const WelcomeScreen = ({ userName, logoUrl }: { userName: string; logoUrl: string | null }) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => setOpacity(1));
    const timer = setTimeout(() => setOpacity(0), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-background gap-6"
      style={{ opacity, transition: "opacity 0.6s ease-in-out" }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="w-24 h-24 rounded-2xl object-cover shadow-lg" />
      ) : (
        <div className="w-24 h-24 bg-primary/10 rounded-2xl flex items-center justify-center shadow-lg">
          <Building2 className="w-12 h-12 text-primary" />
        </div>
      )}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Bem-vindo(a)!</h1>
        <p className="text-lg text-muted-foreground">{userName}</p>
      </div>
    </div>
  );
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);

  useEffect(() => {
    if (user && profile?.clinic_id) {
      // Fetch clinic logo for welcome screen & save to localStorage
      supabase
        .from("clinics")
        .select("logo_url, name")
        .eq("id", profile.clinic_id)
        .single()
        .then(({ data }) => {
          if (data?.logo_url) {
            setClinicLogo(data.logo_url);
            localStorage.setItem("clinic_logo_url", data.logo_url);
          }
          if (data?.name) localStorage.setItem("clinic_name", data.name);
        });

      // Show welcome only once per session
      if (!sessionStorage.getItem("welcomed")) {
        sessionStorage.setItem("welcomed", "1");
        setShowWelcome(true);
        setTimeout(() => setShowWelcome(false), 2800);
      }
    }
  }, [user, profile?.clinic_id]);

  if (loading) return <LoadingScreen />;

  // Profile still loading (user exists but profile not fetched yet)
  if (user && profile === null) return <LoadingScreen />;

  if (!user) return <Navigate to="/" replace />;

  // User exists, profile loaded, but no clinic
  if (!profile?.clinic_id) return <Navigate to="/onboarding" replace />;

  if (showWelcome) {
    return <WelcomeScreen userName={profile.full_name || "Usuário"} logoUrl={clinicLogo} />;
  }

  return <>{children}</>;
};

const OnboardingRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user && profile === null) return <LoadingScreen />;

  if (!user) return <Navigate to="/" replace />;
  if (profile?.clinic_id) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user && profile === null) return <LoadingScreen />;

  if (user && profile?.clinic_id) return <Navigate to="/dashboard" replace />;
  if (user && !profile?.clinic_id) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
