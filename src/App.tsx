import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Loteamentos from "./pages/Loteamentos";
import Lotes from "./pages/Lotes";
import Vendas from "./pages/Vendas";
import Pagamentos from "./pages/Pagamentos";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Auditoria from "./pages/Auditoria";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import PrimeiroAcesso from "./pages/PrimeiroAcesso";
import Admin from "./pages/Admin";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { PWAInstallBanner } from "./components/PWAInstallBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 minutos
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RequireAuth({ children }: { children: JSX.Element }) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RequirePlatformAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();

  if (user?.login?.toLowerCase() !== "gcgean") {
    return <Navigate to="/" replace />;
  }

  return children;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="sislote-theme">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAInstallBanner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/clientes"
              element={
                <RequireAuth>
                  <Clientes />
                </RequireAuth>
              }
            />
            <Route
              path="/loteamentos"
              element={
                <RequireAuth>
                  <Loteamentos />
                </RequireAuth>
              }
            />
            <Route
              path="/lotes"
              element={
                <RequireAuth>
                  <Lotes />
                </RequireAuth>
              }
            />
            <Route
              path="/vendas"
              element={
                <RequireAuth>
                  <Vendas />
                </RequireAuth>
              }
            />
            <Route
              path="/pagamentos"
              element={
                <RequireAuth>
                  <Pagamentos />
                </RequireAuth>
              }
            />
            <Route
              path="/relatorios"
              element={
                <RequireAuth>
                  <Relatorios />
                </RequireAuth>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <RequireAuth>
                  <Configuracoes />
                </RequireAuth>
              }
            />
            <Route
              path="/auditoria"
              element={
                <RequireAuth>
                  <Auditoria />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequirePlatformAdmin>
                    <Admin />
                  </RequirePlatformAdmin>
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
