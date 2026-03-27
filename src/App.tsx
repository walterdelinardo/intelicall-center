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

/** Extract dominant colors from an image via canvas sampling */
const extractColors = (imgSrc: string): Promise<string[]> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve([]);
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const buckets: Record<string, { r: number; g: number; b: number; count: number }> = {};
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue;
        if (r > 230 && g > 230 && b > 230) continue;
        if (r < 25 && g < 25 && b < 25) continue;
        const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`;
        if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
        buckets[key].r += r;
        buckets[key].g += g;
        buckets[key].b += b;
        buckets[key].count++;
      }
      const sorted = Object.values(buckets).sort((a, b) => b.count - a.count);
      const colors = sorted.slice(0, 3).map((b) => {
        const r = Math.round(b.r / b.count);
        const g = Math.round(b.g / b.count);
        const bl = Math.round(b.b / b.count);
        return `${r}, ${g}, ${bl}`;
      });
      resolve(colors);
    };
    img.onerror = () => resolve([]);
    img.src = imgSrc;
  });

const WelcomeScreen = ({ userName, logoUrl }: { userName: string; logoUrl: string | null }) => {
  const [opacity, setOpacity] = useState(0);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => setOpacity(1));
    const timer = setTimeout(() => setOpacity(0), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (logoUrl) {
      extractColors(logoUrl).then((c) => {
        if (c.length > 0) setColors(c);
      });
    }
  }, [logoUrl]);

  const c1 = colors[0] || "59, 130, 246";
  const c2 = colors[1] || colors[0] || "99, 102, 241";
  const c3 = colors[2] || colors[0] || "147, 51, 234";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-background gap-8 relative overflow-hidden"
      style={{ opacity, transition: "opacity 0.6s ease-in-out" }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: "600px", height: "600px",
            top: "-120px", right: "-180px",
            backgroundColor: `rgba(${c1}, 0.07)`,
            animation: "welcomePulse 4s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "500px", height: "500px",
            bottom: "-100px", left: "-150px",
            backgroundColor: `rgba(${c2}, 0.05)`,
            animation: "welcomePulse 5s ease-in-out infinite 0.5s",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "300px", height: "300px",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: `rgba(${c3}, 0.06)`,
            animation: "welcomePulse 6s ease-in-out infinite 1s",
          }}
        />
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${4 + i * 2}px`,
              height: `${4 + i * 2}px`,
              top: `${10 + i * 11}%`,
              left: `${8 + i * 12}%`,
              backgroundColor: `rgba(${[c1, c2, c3][i % 3]}, ${0.12 + (i % 3) * 0.05})`,
              animation: `welcomeFloat ${3 + i * 0.5}s ease-in-out infinite ${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8"
        style={{ animation: "welcomeFadeUp 0.8s ease-out forwards" }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="w-32 h-32 rounded-2xl object-cover shadow-xl"
            style={{ boxShadow: `0 8px 32px -8px rgba(${c1}, 0.3)`, border: `3px solid rgba(${c1}, 0.15)` }}
          />
        ) : (
          <div className="w-32 h-32 bg-primary/10 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-primary/10">
            <Building2 className="w-16 h-16 text-primary" />
          </div>
        )}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">Bem-vindo(a)!</h1>
          <p className="text-2xl text-muted-foreground font-medium">{userName}</p>
        </div>
        <div className="flex gap-1.5 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: `rgba(${[c1, c2, c3][i]}, 0.5)`,
                animation: `welcomeBounce 1.2s ease-in-out infinite ${i * 0.15}s`,
              }}
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
