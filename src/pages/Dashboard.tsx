import { AppLayout } from "@/components/layout/AppLayout";
import {
  Users,
  MapPin,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

const kpis = [
  {
    title: "Clientes",
    value: "342",
    change: "+12 este mês",
    icon: Users,
    color: "text-info" as const,
  },
  {
    title: "Loteamentos",
    value: "8",
    subtitle: "1.240 lotes",
    icon: MapPin,
    color: "text-primary" as const,
  },
  {
    title: "Vendas Ativas",
    value: "186",
    change: "+5 esta semana",
    icon: ShoppingCart,
    color: "text-success" as const,
  },
  {
    title: "Recebido (mês)",
    value: "R$ 284.500",
    change: "+18% vs anterior",
    icon: TrendingUp,
    color: "text-primary" as const,
  },
  {
    title: "Títulos em Atraso",
    value: "23",
    change: "R$ 45.200 pendente",
    icon: AlertTriangle,
    color: "text-warning" as const,
  },
  {
    title: "Pagamentos (mês)",
    value: "94",
    change: "R$ 312.800 total",
    icon: CreditCard,
    color: "text-info" as const,
  },
];

const recentSales = [
  { client: "João Silva", lot: "Quadra A - Lote 12", date: "12/02/2026", value: "R$ 85.000" },
  { client: "Maria Santos", lot: "Quadra B - Lote 5", date: "10/02/2026", value: "R$ 72.000" },
  { client: "Carlos Lima", lot: "Quadra C - Lote 8", date: "08/02/2026", value: "R$ 95.000" },
  { client: "Ana Oliveira", lot: "Quadra A - Lote 3", date: "05/02/2026", value: "R$ 68.000" },
  { client: "Pedro Souza", lot: "Quadra D - Lote 1", date: "03/02/2026", value: "R$ 110.000" },
];

const overdue = [
  { client: "Roberto Costa", installment: "5/24", days: 15, value: "R$ 1.850" },
  { client: "Fernanda Alves", installment: "3/12", days: 8, value: "R$ 2.400" },
  { client: "Lucas Mendes", installment: "7/36", days: 22, value: "R$ 1.200" },
];

const Dashboard = () => {
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
              {recentSales.map((sale, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{sale.client}</p>
                    <p className="text-xs text-muted-foreground">{sale.lot}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{sale.value}</p>
                    <p className="text-xs text-muted-foreground">{sale.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overdue */}
          <div className="glass-card rounded-lg">
            <div className="p-5 border-b border-border">
              <h2 className="text-sm font-semibold">Títulos em Atraso</h2>
            </div>
            <div className="divide-y divide-border">
              {overdue.map((item, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.client}</p>
                    <p className="text-xs text-muted-foreground">Parcela {item.installment}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-warning">{item.value}</p>
                    <p className="text-xs text-destructive">{item.days} dias atraso</p>
                  </div>
                </div>
              ))}
            </div>
            {overdue.length === 0 && (
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
