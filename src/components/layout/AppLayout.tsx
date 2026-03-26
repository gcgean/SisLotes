import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, Sun, Moon, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: empresa } = useQuery<{ nome_fantasia: string }>({
    queryKey: ["minha-empresa"],
    queryFn: async () => {
      const token = window.localStorage.getItem("token");
      const res = await fetch("/api/empresas/minha", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar empresa");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* AppSidebar: on mobile renders as Sheet (drawer), on md+ as fixed sidebar */}
        <AppSidebar />

        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <header className="h-14 flex items-center border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            {/* Sidebar trigger — on mobile opens the Sheet, on desktop toggles collapse */}
            <SidebarTrigger className="mr-4">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">SISLOTE</span>
              {empresa && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground border-l border-border pl-3 ml-1">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-foreground">{empresa.nome_fantasia}</span>
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {user && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Logado como <span className="font-medium text-foreground">{user.login}</span>
                </span>
              )}
              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* pb-20 on mobile to clear bottom nav, pb-6 on desktop */}
          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* Bottom navigation bar — only on mobile (md:hidden via CSS) */}
      <BottomNav />
    </SidebarProvider>
  );
}
