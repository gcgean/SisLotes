import { AppLayout } from "@/components/layout/AppLayout";
import {
  Users,
  MapPin,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
}

interface DashboardVendaRecente {
  id_venda: number;
  cliente: string;
  lote: string;
  data_venda: string;
  valor_total: number;
}

const Dashboard = () => {
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

  const { data: atrasos = [] } = useQuery<DashboardTituloAtraso[]>({
    queryKey: ["dashboard", "titulos-em-atraso"],
    queryFn: async () => {
      const response = await fetch("/api/relatorios/titulos-em-atraso", {
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

  const totalTitulosAtraso = atrasos.length;
  const totalValorAtraso = atrasos.reduce((sum, item) => sum + item.valor, 0);

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
      value: "—",
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
      value: "—",
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
          <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema</p>
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
                    <p className="text-xs text-muted-foreground">{sale.data_venda}</p>
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
