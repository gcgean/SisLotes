import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Users,
  MapPin,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { formatLicenseRemainingTime } from "@/lib/license-time";
import { formatDateBR } from "@/lib/date-br";

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface DashboardTituloAtraso {
  cliente: string;
  parcela: string;
  diasAtraso: number;
  valor: number;
}

interface DashboardKpis {
  totalClientes: number;
  vendasAtivas: number;
  recebidoMes: number;
  totalLoteamentos?: number;
  pagamentosMes?: number;
  titulosAtrasoQtd: number;
  titulosAtrasoValor: number;
}

interface DashboardVendaRecente {
  id_venda: number;
  cliente: string;
  lote: string;
  data_venda: string;
  valor_total: number;
}

interface LicenseStatus {
  plano?: string | null;
  hub_license_status?: string | null;
  days_left?: number | null;
  hub_expires_at?: string | null;
}
interface PlanoCatalogo {
  code: string;
  title: string;
}

const Dashboard = () => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const { data: empresa } = useQuery<{ nome_fantasia: string; cidade?: string; estado?: string }>({
    queryKey: ["minha-empresa"],
    queryFn: async () => {
      const token = window.localStorage.getItem("token");
      const res = await fetch("/api/empresas/minha", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: kpisData } = useQuery<DashboardKpis>({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => {
      const response = await fetch("/api/relatorios/dashboard-kpis", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar KPIs do dashboard");
      }

      return response.json();
    },
  });

  const { data: licenca } = useQuery<LicenseStatus>({
    queryKey: ["hub-billing", "license-status"],
    queryFn: async () => {
      const response = await fetch("/api/hub-billing/license-status", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Erro ao carregar licença");
      }
      return response.json();
    },
  });
  const { data: planosDisponiveis = [] } = useQuery<PlanoCatalogo[]>({
    queryKey: ["hub-billing", "planos-disponiveis"],
    queryFn: async () => {
      const response = await fetch("/api/hub-billing/planos-disponiveis", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray((data as { planos?: unknown[] }).planos)
        ? ((data as { planos: PlanoCatalogo[] }).planos)
        : [];
    },
    staleTime: 60_000,
  });
  const planoAtualLabel = (() => {
    const raw = (licenca?.plano || "").trim();
    if (!raw) return null;
    const hub = planosDisponiveis.find((p) => p.code.toUpperCase() === raw.toUpperCase())?.title;
    return hub || raw;
  })();

  const { data: atrasos = [] } = useQuery<DashboardTituloAtraso[]>({
    queryKey: ["dashboard", "titulos-em-atraso"],
    queryFn: async () => {
      const response = await fetch("/api/relatorios/titulos-em-atraso?limit=10", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar títulos em atraso");
      }

      type AtrasoApiItem = {
        cliente: string;
        parcela: string;
        diasAtraso: number;
        total: number | string;
      };

      const data = (await response.json()) as AtrasoApiItem[];

      return data.map((item) => ({
        cliente: item.cliente,
        parcela: item.parcela,
        diasAtraso: Number(item.diasAtraso),
        valor: Number(item.total),
      }));
    },
  });

  const { data: vendasRecentes = [] } = useQuery<DashboardVendaRecente[]>({
    queryKey: ["dashboard", "vendas-recentes"],
    queryFn: async () => {
      const response = await fetch("/api/relatorios/vendas-recentes", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar vendas recentes");
      }

      type VendaRecenteApi = {
        id_venda: number;
        cliente: string;
        lote: string;
        data_venda: string;
        valor_total: number | string | null;
      };

      const data = (await response.json()) as VendaRecenteApi[];

      return data.map((item) => ({
        id_venda: Number(item.id_venda),
        cliente: item.cliente,
        lote: item.lote,
        data_venda: item.data_venda,
        valor_total: Number(item.valor_total ?? 0),
      }));
    },
  });

  const totalTitulosAtraso = kpisData?.titulosAtrasoQtd ?? 0;
  const totalValorAtraso = kpisData?.titulosAtrasoValor ?? 0;

  const kpis = [
    {
      title: "Clientes",
      value: kpisData ? String(kpisData.totalClientes) : "—",
      change: "",
      icon: Users,
      color: "text-info" as const,
    },
    {
      title: "Loteamentos",
      value: kpisData?.totalLoteamentos != null ? String(kpisData.totalLoteamentos) : "—",
      subtitle: "",
      icon: MapPin,
      color: "text-primary" as const,
    },
    {
      title: "Vendas Ativas",
      value: kpisData ? String(kpisData.vendasAtivas) : "—",
      change: "",
      icon: ShoppingCart,
      color: "text-success" as const,
    },
    {
      title: "Recebido (mês)",
      value: kpisData ? formatCurrency(kpisData.recebidoMes) : "—",
      change: "",
      icon: TrendingUp,
      color: "text-primary" as const,
    },
    {
      title: "Títulos em Atraso",
      value: String(totalTitulosAtraso),
      change:
        totalTitulosAtraso > 0 ? `${formatCurrency(totalValorAtraso)} pendente` : "Nenhum título em atraso",
      icon: AlertTriangle,
      color: "text-warning" as const,
    },
    {
      title: "Pagamentos (mês)",
      value: kpisData?.pagamentosMes != null ? String(kpisData.pagamentosMes) : "—",
      change: "",
      icon: CreditCard,
      color: "text-info" as const,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          {empresa ? (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="font-medium text-foreground">{empresa.nome_fantasia}</span>
              {empresa.cidade && (
                <span className="text-muted-foreground">
                  — {empresa.cidade}{empresa.estado ? `/${empresa.estado}` : ""}
                </span>
              )}
              {planoAtualLabel && (
                <Badge variant="outline" className="ml-2 capitalize">
                  Plano {planoAtualLabel}
                </Badge>
              )}
              {licenca?.hub_license_status && (
                <Badge
                  variant={licenca.hub_license_status === "active" ? "default" : "destructive"}
                  className="capitalize"
                >
                  {licenca.hub_license_status}
                </Badge>
              )}
              <Badge variant="secondary">
                {formatLicenseRemainingTime({
                  daysLeft: licenca?.days_left ?? null,
                  expiresAt: licenca?.hub_expires_at ?? null,
                  nowMs,
                })}
              </Badge>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema</p>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.title}
              className="glass-card rounded-lg p-5 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  {kpi.change && (
                    <p className="text-xs text-muted-foreground">{kpi.change}</p>
                  )}
                  {kpi.subtitle && (
                    <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                  )}
                </div>
                <div className={`p-2.5 rounded-lg bg-muted ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Sales */}
          <div className="glass-card rounded-lg">
            <div className="p-5 border-b border-border">
              <h2 className="text-sm font-semibold">Vendas Recentes</h2>
            </div>
            <div className="divide-y divide-border">
              {vendasRecentes.map((sale) => (
                <div key={sale.id_venda} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{sale.cliente}</p>
                    <p className="text-xs text-muted-foreground">{sale.lote}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatCurrency(sale.valor_total)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateBR(sale.data_venda, sale.data_venda)}</p>
                  </div>
                </div>
              ))}
              {vendasRecentes.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma venda recente
                </div>
              )}
            </div>
          </div>

          {/* Overdue */}
          <div className="glass-card rounded-lg">
            <div className="p-5 border-b border-border">
              <h2 className="text-sm font-semibold">Títulos em Atraso</h2>
            </div>
            <div className="divide-y divide-border">
              {atrasos.map((item, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.cliente}</p>
                    <p className="text-xs text-muted-foreground">Parcela {item.parcela}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-warning">{formatCurrency(item.valor)}</p>
                    <p className="text-xs text-destructive">{item.diasAtraso} dias atraso</p>
                  </div>
                </div>
              ))}
            </div>
            {atrasos.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum título em atraso
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
