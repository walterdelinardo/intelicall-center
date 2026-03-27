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
      className="min-h-screen flex flex-col items-center justify-center bg-background gap-8 relative overflow-hidden"
      style={{ opacity, transition: "opacity 0.6s ease-in-out" }}
    >
      {/* Animated background circles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full bg-primary/5"
          style={{
            width: "600px", height: "600px",
            top: "-120px", right: "-180px",
            animation: "welcomePulse 4s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full bg-primary/[0.03]"
          style={{
            width: "500px", height: "500px",
            bottom: "-100px", left: "-150px",
            animation: "welcomePulse 5s ease-in-out infinite 0.5s",
          }}
        />
        <div
          className="absolute rounded-full bg-accent/30"
          style={{
            width: "300px", height: "300px",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            animation: "welcomePulse 6s ease-in-out infinite 1s",
          }}
        />
        {/* Subtle moving dots */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary/10"
            style={{
              width: `${4 + i * 2}px`,
              height: `${4 + i * 2}px`,
              top: `${15 + i * 14}%`,
              left: `${10 + i * 15}%`,
              animation: `welcomeFloat ${3 + i * 0.5}s ease-in-out infinite ${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8"
        style={{ animation: "welcomeFadeUp 0.8s ease-out forwards" }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-32 h-32 rounded-2xl object-cover shadow-xl ring-4 ring-primary/10" />
        ) : (
          <div className="w-32 h-32 bg-primary/10 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-primary/10">
            <Building2 className="w-16 h-16 text-primary" />
          </div>
        )}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">Bem-vindo(a)!</h1>
          <p className="text-2xl text-muted-foreground font-medium">{userName}</p>
        </div>
        {/* Subtle loading indicator */}
        <div className="flex gap-1.5 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary/40"
              style={{ animation: `welcomeBounce 1.2s ease-in-out infinite ${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes welcomePulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes welcomeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes welcomeFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes welcomeBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    if (user && profile?.clinic_id) {
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
          setDataReady(true);
        });

      // Minimum 2.5s welcome screen
      const timer = setTimeout(() => setMinTimePassed(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [user, profile?.clinic_id]);

  // Dismiss welcome when both minimum time passed AND data is ready
  useEffect(() => {
    if (minTimePassed && dataReady) {
      const fadeTimer = setTimeout(() => setShowWelcome(false), 600);
      return () => clearTimeout(fadeTimer);
    }
  }, [minTimePassed, dataReady]);

  if (loading) return <LoadingScreen />;
  if (user && profile === null) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
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
