import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react";

type VendaStatus = "aberta" | "quitada" | "cancelada";

interface VendaListItem {
  id_venda: number;
  cliente: string;
  lote: string;
  loteamento: string;
  data_venda: string;
  valor_entrada: number;
  parcelas: number;
  porcentagem: number;
  status: VendaStatus;
  valor_total: number;
}

const statusConfig: Record<VendaStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  aberta: { label: "Aberta", variant: "default" },
  quitada: { label: "Quitada", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const Vendas = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | VendaStatus>("all");

  const { data: vendas = [], isLoading, isError } = useQuery<VendaListItem[]>({
    queryKey: ["vendas"],
    queryFn: async () => {
      const response = await fetch("/api/vendas", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar vendas");
      }

      const data = (await response.json()) as VendaListItem[];

      return data.map((venda) => ({
        ...venda,
        status: venda.status as VendaStatus,
      }));
    },
  });

  const filtered = vendas.filter((v) => {
    const matchSearch =
      v.cliente.toLowerCase().includes(search.toLowerCase()) ||
      v.lote.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || v.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Carregando vendas..." : `${vendas.length} vendas registradas`}
            </p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Venda
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou lote..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "aberta", "quitada", "cancelada"] as const).map((s) => (
              <Button
                key={s}
                variant={filterStatus === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(s)}
              >
                {s === "all" ? "Todas" : statusConfig[s].label}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Valor Total</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Entrada</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcelas</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Juros</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((venda) => (
                  <tr key={venda.id_venda} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{venda.cliente}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div>
                        <span>{venda.lote}</span>
                        <p className="text-xs text-muted-foreground/60">{venda.loteamento}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{venda.data_venda}</td>
                    <td className="px-5 py-3 font-medium">{formatCurrency(venda.valor_total)}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatCurrency(venda.valor_entrada)}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{venda.parcelas}x</td>
                    <td className="px-5 py-3 text-muted-foreground">{venda.porcentagem}%</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusConfig[venda.status].variant}>
                        {statusConfig[venda.status].label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma venda encontrada</div>
          )}
          {isError && (
            <div className="p-12 text-center text-sm text-destructive">Erro ao carregar vendas</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Vendas;
