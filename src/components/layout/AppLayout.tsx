import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, Sun, Moon, Building2, CreditCard, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { formatLicenseRemainingTime } from "@/lib/license-time";
import { formatDateBR } from "@/lib/date-br";

interface AppLayoutProps {
  children: ReactNode;
}

interface LicenseStatus {
  plano?: string | null;
  hub_license_status?: string | null;
  hub_license_reason?: string | null;
  hub_expires_at?: string | null;
  hub_customer_id?: string | null;
  hub_configured?: boolean;
  days_left?: number | null;
  banner?: string | null;
  access_status?: string | null;
}

interface PlanoCatalogo {
  code: string;
  title: string;
}

const BLOCKED_STATUSES = new Set([
  "blocked",
  "trial_expired",
  "customer_blocked",
  "no_license",
  "license_suspended",
  "license_expired",
  "license_revoked",
  "license_inactive",
]);

function isLicenseBlocked(data?: LicenseStatus | null) {
  if (!data?.hub_configured) return false;
  if (!data?.hub_customer_id) return false;
  const status = (data?.hub_license_status || "").toLowerCase();
  return BLOCKED_STATUSES.has(status);
}

function getAuthToken() {
  return window.localStorage.getItem("token");
}

function getPlanLabel(data?: LicenseStatus | null, planos?: PlanoCatalogo[] | null) {
  const raw = (data?.plano || "").trim();
  if (raw) {
    const fromHub = (planos ?? []).find((p) => p.code.toUpperCase() === raw.toUpperCase())?.title;
    return fromHub || raw;
  }
  const status = (data?.hub_license_status || "").toLowerCase();
  if (status === "trial" || status === "trial_active") return "Teste";
  if (status === "licensed" || status === "active") return "Licença ativa";
  return "Sem plano";
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: empresa } = useQuery<{ nome_fantasia: string }>({
    queryKey: ["minha-empresa"],
    queryFn: async () => {
      const res = await fetch("/api/empresas/minha", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar empresa");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: licenseData } = useQuery<LicenseStatus>({
    queryKey: ["hub-billing", "license-status"],
    queryFn: async () => {
      const res = await fetch("/api/hub-billing/license-status", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: planosDisponiveis } = useQuery<PlanoCatalogo[]>({
    queryKey: ["hub-billing", "planos-disponiveis"],
    queryFn: async () => {
      const res = await fetch("/api/hub-billing/planos-disponiveis", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray((data as { planos?: unknown[] }).planos)
        ? ((data as { planos: PlanoCatalogo[] }).planos)
        : [];
    },
    staleTime: 60_000,
  });

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  const blocked = isLicenseBlocked(licenseData);
  const expiresDate = licenseData?.hub_expires_at ? formatDateBR(licenseData.hub_expires_at, "") : null;
  const daysLeft = typeof licenseData?.days_left === "number" ? licenseData.days_left : null;
  const planLabel = getPlanLabel(licenseData, planosDisponiveis);
  const licenseTimeLabel = formatLicenseRemainingTime({
    daysLeft,
    expiresAt: licenseData?.hub_expires_at ?? null,
    nowMs,
  });
  const onPlanosPage = location.pathname.startsWith("/planos");
  const isDueSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 5;

  useEffect(() => {
    if (!blocked) return;
    if (onPlanosPage) return;
    const reason = licenseData?.hub_license_reason || licenseData?.hub_license_status || "license_inactive";
    navigate(`/planos?reason=${encodeURIComponent(reason)}`, { replace: true });
  }, [blocked, onPlanosPage, licenseData?.hub_license_reason, licenseData?.hub_license_status, navigate]);

  useEffect(() => {
    if (!licenseData?.hub_configured) return;
    if (!licenseData?.hub_customer_id) return;
    if (!isDueSoon) return;
    if (blocked) return;
    if (onPlanosPage) return;

    const companyKey = user?.id_empresa ?? "empresa";
    const key = `hub-payment-prompt:${companyKey}:${licenseData?.hub_expires_at ?? daysLeft}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");

    const wantsToPay = window.confirm(
      "Seu plano vence em breve. Deseja efetuar o pagamento agora para não perder acesso ao sistema?",
    );
    if (wantsToPay) {
      navigate("/planos?payCurrent=1", { replace: false });
    }
  }, [
    blocked,
    daysLeft,
    isDueSoon,
    licenseData?.hub_configured,
    licenseData?.hub_customer_id,
    licenseData?.hub_expires_at,
    navigate,
    onPlanosPage,
    user?.id_empresa,
  ]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* AppSidebar: on mobile renders as Sheet (drawer), on md+ as fixed sidebar */}
        <AppSidebar />

        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <header className="h-14 flex items-center border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            {/* Sidebar trigger */}
            <SidebarTrigger className="mr-4">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-foreground shrink-0">SISLOTE</span>
              {empresa && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground border-l border-border pl-3 ml-1">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-foreground truncate max-w-[140px]">{empresa.nome_fantasia}</span>
                </span>
              )}
              <Link
                  to="/planos"
                  className="hidden md:flex items-center gap-1 text-xs text-muted-foreground border-l border-border pl-3 ml-1 transition-colors hover:text-foreground hover:underline underline-offset-4"
                  title="Ir para Planos"
              >
                  <CreditCard className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-foreground">{planLabel}</span>
                  {expiresDate && (
                    <span className="text-muted-foreground/70">· até {expiresDate}</span>
                  )}
                  <span className={daysLeft != null && daysLeft <= 5 ? "text-amber-600 font-medium" : "text-muted-foreground/70"}>
                    · {licenseTimeLabel.toLowerCase()}
                  </span>
              </Link>
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
            {licenseData?.banner && (
              <div className="mb-4 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {licenseData.banner}
              </div>
            )}
            {!blocked && isDueSoon && (
              <div className="mb-4 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Seu plano vence em breve ({licenseTimeLabel.toLowerCase()}). Evite bloqueio efetuando o pagamento agora.
                </span>
                {!onPlanosPage && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-400 bg-white hover:bg-amber-100"
                    onClick={() => navigate("/planos?payCurrent=1")}
                  >
                    Pagar agora
                  </Button>
                )}
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      {/* Bottom navigation bar — only on mobile */}
      <BottomNav />

      {/* ── Botão flutuante WhatsApp Suporte ──────────────────────────── */}
      <a
        href="https://wa.me/5585920066836?text=Ol%C3%A1!%20Preciso%20de%20suporte%20com%20o%20SISLOTE."
        target="_blank"
        rel="noopener noreferrer"
        title="Suporte via WhatsApp"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[150] flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 group px-3 py-3 md:px-4"
      >
        {/* Ícone WhatsApp */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-6 w-6 shrink-0 fill-white">
          <path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.668 4.61 1.832 6.505L4 29l7.695-1.813A11.94 11.94 0 0016 28c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10a9.96 9.96 0 01-5.03-1.352l-.36-.218-4.568 1.076 1.104-4.44-.237-.373A9.958 9.958 0 016 15c0-5.523 4.477-10 10-10zm-3.16 5c-.19 0-.499.071-.76.356-.261.285-1 .977-1 2.38s1.023 2.76 1.165 2.95c.143.19 1.977 3.15 4.86 4.29.679.271 1.208.433 1.621.555.681.201 1.302.173 1.792.105.547-.076 1.686-.689 1.924-1.354.238-.665.238-1.236.167-1.354-.071-.119-.261-.19-.547-.333-.285-.143-1.686-.833-1.948-.928-.261-.095-.451-.143-.641.143-.19.285-.737.928-.903 1.118-.166.19-.333.214-.618.071-.285-.143-1.203-.443-2.291-1.413-.847-.754-1.419-1.686-1.585-1.971-.167-.285-.018-.44.125-.582.128-.128.285-.333.428-.499.143-.166.19-.285.285-.475.095-.19.048-.357-.024-.499-.071-.143-.641-1.547-.878-2.118-.228-.552-.462-.476-.641-.485L12.84 10z" />
        </svg>
        {/* Label visível em desktop */}
        <span className="hidden md:inline text-sm font-semibold whitespace-nowrap">Suporte</span>
      </a>

      {/* ── Bloqueio de licença ───────────────────────────────────────── */}
      {blocked && !onPlanosPage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="max-w-md w-full mx-4 rounded-xl border bg-card p-8 space-y-5 text-center shadow-xl">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Acesso bloqueado</h2>
              <p className="text-sm text-muted-foreground">
                {licenseData?.hub_license_status === "license_expired" || licenseData?.hub_license_status === "trial_expired"
                  ? "Seu período de teste encerrou."
                : licenseData?.hub_license_status === "license_suspended"
                  ? "Sua licença foi suspensa por falta de pagamento."
                  : "Sua licença está inativa."}
                {" "}Regularize seu plano para continuar usando o sistema.
              </p>
              {licenseData?.plano && (
                <p className="text-xs text-muted-foreground">
                  Plano atual: <span className="font-medium">{planLabel}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Button className="w-full" onClick={() => navigate("/planos")}>
                Ver planos e renovar
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={handleLogout}>
                Sair da conta
              </Button>
            </div>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
