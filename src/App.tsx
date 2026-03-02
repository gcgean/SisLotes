import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Loteamentos from "./pages/Loteamentos";
import Lotes from "./pages/Lotes";
import Vendas from "./pages/Vendas";
import Pagamentos from "./pages/Pagamentos";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { AuthProvider, useAuth } from "./hooks/useAuth";

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: JSX.Element }) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
