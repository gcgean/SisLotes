import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { token, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando sessão...</div>;
  }

  if (!token) {
    const destino = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(destino)}`} replace />;
  }

  return children;
}
