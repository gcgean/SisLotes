import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";

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
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 flex items-center border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            <SidebarTrigger className="mr-4">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">SISLOTE</span>
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
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
