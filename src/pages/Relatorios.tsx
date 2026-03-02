import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, BarChart3, DollarSign, Users, Calendar } from "lucide-react";

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const reportTypes = [
  {
    id: "entradas",
    title: "Entradas por Loteamento",
    description: "Resumo de entradas recebidas por loteamento no ano selecionado",
    icon: BarChart3,
  },
  {
    id: "enderecos",
    title: "Endereços para Carnê",
    description: "Lista de endereços dos clientes para emissão de carnês",
    icon: FileText,
  },
  {
    id: "atraso",
    title: "Títulos em Atraso",
    description: "Listagem completa de títulos vencidos e não pagos",
    icon: Calendar,
  },
  {
    id: "total-conta",
    title: "Total por Conta",
    description: "Totais recebidos agrupados por conta bancária",
    icon: DollarSign,
  },
  {
    id: "juros",
    title: "Juros Recebidos",
    description: "Relatório de juros e multas recebidos no período",
    icon: DollarSign,
  },
  {
    id: "clientes-conta",
    title: "Clientes por Conta",
    description: "Clientes agrupados por conta bancária utilizada",
    icon: Users,
  },
];

interface EntradasPorLoteamento {
  id_loteamento: number;
  loteamento: string;
  jan: number;
  fev: number;
  mar: number;
  abr: number;
  total: number;
}

interface TituloEmAtraso {
  id_pagamento: number;
  cliente: string;
  lote: string;
  parcela: string;
  vencimento: string;
  valor: number;
  diasAtraso: number;
  multa: number;
  juros: number;
  total: number;
}

const mockContaTotais = [
  { conta: "Banco do Brasil", apelido: "BB Principal", agencia: "1234", total: 185400, qtdPagamentos: 42 },
  { conta: "Caixa Econômica", apelido: "Caixa", agencia: "5678", total: 98200, qtdPagamentos: 28 },
  { conta: "Itaú", apelido: "Itaú Emp.", agencia: "9012", total: 62800, qtdPagamentos: 15 },
];

const Relatorios = () => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [ano, setAno] = useState("2026");

  const { data: entradasData = [], isLoading: loadingEntradas } = useQuery<EntradasPorLoteamento[]>({
    queryKey: ["relatorios", "entradas-por-loteamento", ano],
    queryFn: async () => {
      const params = new URLSearchParams({ ano });
      const response = await fetch(`/api/relatorios/entradas-por-loteamento?${params.toString()}`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar relatório de entradas por loteamento");
      }

      return response.json();
    },
    enabled: selectedReport === "entradas",
  });

  const { data: atrasadosData = [], isLoading: loadingAtrasados } = useQuery<TituloEmAtraso[]>({
    queryKey: ["relatorios", "titulos-em-atraso"],
    queryFn: async () => {
      const response = await fetch("/api/relatorios/titulos-em-atraso", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar relatório de títulos em atraso");
      }

      return response.json();
    },
    enabled: selectedReport === "atraso",
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Geração de relatórios e consultas</p>
        </div>

        {!selectedReport ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reportTypes.map((report, i) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className="glass-card rounded-lg p-5 text-left hover:border-primary/40 transition-all cursor-pointer animate-fade-in group"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-muted text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <report.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{report.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
                ← Voltar
              </Button>
              <div className="flex gap-2">
                <Select value={ano} onValueChange={setAno}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </div>
            </div>

            {selectedReport === "entradas" && (
              <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold">Entradas por Loteamento – {ano}</h2>
                </div>
                {loadingEntradas ? (
                  <div className="p-5 text-sm text-muted-foreground">Carregando dados...</div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Loteamento</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Jan</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Fev</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Mar</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Abr</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {entradasData.map((row) => (
                        <tr key={row.loteamento} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 font-medium">{row.loteamento}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.jan)}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.fev)}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.mar)}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.abr)}</td>
                          <td className="px-5 py-3 text-right font-bold">{formatCurrency(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td className="px-5 py-3 font-bold">Total Geral</td>
                        <td className="px-5 py-3 text-right font-bold">
                          {formatCurrency(entradasData.reduce((s, r) => s + r.jan, 0))}
                        </td>
                        <td className="px-5 py-3 text-right font-bold">
                          {formatCurrency(entradasData.reduce((s, r) => s + r.fev, 0))}
                        </td>
                        <td className="px-5 py-3 text-right font-bold">
                          {formatCurrency(entradasData.reduce((s, r) => s + r.mar, 0))}
                        </td>
                        <td className="px-5 py-3 text-right font-bold">
                          {formatCurrency(entradasData.reduce((s, r) => s + r.abr, 0))}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-primary">
                          {formatCurrency(entradasData.reduce((s, r) => s + r.total, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                )}
              </div>
            )}

            {selectedReport === "atraso" && (
              <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold">Títulos em Atraso</h2>
                  <p className="text-xs text-muted-foreground mt-1">Multa: 2% + Juros: 0,20% ao dia</p>
                </div>
                {loadingAtrasados ? (
                  <div className="p-5 text-sm text-muted-foreground">Carregando dados...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cliente</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcela</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Vencimento</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Valor</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Dias</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Multa</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Juros</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {atrasadosData.map((row) => (
                          <tr key={row.id_pagamento} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3 font-medium">{row.cliente}</td>
                            <td className="px-5 py-3 text-muted-foreground">{row.lote}</td>
                            <td className="px-5 py-3 text-muted-foreground">{row.parcela}</td>
                            <td className="px-5 py-3 text-muted-foreground">{row.vencimento}</td>
                            <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.valor)}</td>
                            <td className="px-5 py-3 text-right text-destructive font-medium">{row.diasAtraso}</td>
                            <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.multa)}</td>
                            <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.juros)}</td>
                            <td className="px-5 py-3 text-right font-bold text-warning">{formatCurrency(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {selectedReport === "total-conta" && (
              <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold">Total por Conta Bancária</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Conta</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Apelido</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Agência</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Pagamentos</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mockContaTotais.map((row) => (
                        <tr key={row.conta} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 font-medium">{row.conta}</td>
                          <td className="px-5 py-3 text-muted-foreground">{row.apelido}</td>
                          <td className="px-5 py-3 text-muted-foreground">{row.agencia}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{row.qtdPagamentos}</td>
                          <td className="px-5 py-3 text-right font-bold">{formatCurrency(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(selectedReport === "enderecos" || selectedReport === "juros" || selectedReport === "clientes-conta") && (
              <div className="glass-card rounded-lg p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Relatório: {reportTypes.find(r => r.id === selectedReport)?.title}</p>
                <p className="text-xs text-muted-foreground mt-1">Dados serão carregados do banco de dados quando o backend estiver conectado</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Relatorios;
