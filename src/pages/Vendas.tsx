import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react";

type VendaStatus = "aberta" | "quitada" | "cancelada";

const mockVendas = [
  { id: 1, cliente: "João Silva", lote: "Quadra A - Lote 02", loteamento: "Residencial Primavera", data_venda: "15/01/2026", valor_entrada: 8500, parcelas: 24, porcentagem: 1.5, status: "aberta" as VendaStatus, valorTotal: 85000 },
  { id: 2, cliente: "Construtora ABC", lote: "Quadra B - Lote 01", loteamento: "Jardim das Flores", data_venda: "20/01/2026", valor_entrada: 12000, parcelas: 36, porcentagem: 1.2, status: "aberta" as VendaStatus, valorTotal: 120000 },
  { id: 3, cliente: "Maria Santos", lote: "Quadra C - Lote 01", loteamento: "Vila Verde", data_venda: "10/12/2025", valor_entrada: 7200, parcelas: 12, porcentagem: 1.0, status: "quitada" as VendaStatus, valorTotal: 72000 },
  { id: 4, cliente: "Carlos Lima", lote: "Quadra D - Lote 01", loteamento: "Parque do Sol", data_venda: "05/02/2026", valor_entrada: 9500, parcelas: 48, porcentagem: 1.8, status: "aberta" as VendaStatus, valorTotal: 95000 },
  { id: 5, cliente: "Ana Oliveira", lote: "Quadra A - Lote 03", loteamento: "Residencial Primavera", data_venda: "01/11/2025", valor_entrada: 6800, parcelas: 24, porcentagem: 1.5, status: "cancelada" as VendaStatus, valorTotal: 68000 },
  { id: 6, cliente: "Pedro Souza", lote: "Quadra D - Lote 02", loteamento: "Parque do Sol", data_venda: "03/02/2026", valor_entrada: 11000, parcelas: 36, porcentagem: 1.3, status: "aberta" as VendaStatus, valorTotal: 110000 },
  { id: 7, cliente: "Imobiliária XYZ Ltda", lote: "Quadra B - Lote 02", loteamento: "Jardim das Flores", data_venda: "12/01/2026", valor_entrada: 5500, parcelas: 60, porcentagem: 2.0, status: "aberta" as VendaStatus, valorTotal: 55000 },
];

const statusConfig: Record<VendaStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  aberta: { label: "Aberta", variant: "default" },
  quitada: { label: "Quitada", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const Vendas = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | VendaStatus>("all");

  const filtered = mockVendas.filter((v) => {
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
              {mockVendas.length} vendas registradas
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
                  <tr key={venda.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{venda.cliente}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div>
                        <span>{venda.lote}</span>
                        <p className="text-xs text-muted-foreground/60">{venda.loteamento}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{venda.data_venda}</td>
                    <td className="px-5 py-3 font-medium">{formatCurrency(venda.valorTotal)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatCurrency(venda.valor_entrada)}</td>
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
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhuma venda encontrada
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Vendas;
