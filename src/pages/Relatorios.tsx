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
import { FileText, Download, BarChart3, DollarSign, Users, Calendar } from "lucide-react";

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

// Mock report data
const mockEntradasData = [
  { loteamento: "Residencial Primavera", jan: 28500, fev: 31200, mar: 29800, abr: 33100, total: 122600 },
  { loteamento: "Jardim das Flores", jan: 15000, fev: 18000, mar: 16500, abr: 17200, total: 66700 },
  { loteamento: "Vila Verde", jan: 42000, fev: 38500, mar: 41000, abr: 39800, total: 161300 },
  { loteamento: "Parque do Sol", jan: 22000, fev: 24500, mar: 23800, abr: 25100, total: 95400 },
];

const mockAtrasados = [
  { cliente: "Carlos Lima", lote: "Q.D - L.01", parcela: "1/48", vencimento: "05/01/2026", valor: 1781.25, diasAtraso: 42, multa: 35.63, juros: 149.63, total: 1966.50 },
  { cliente: "Carlos Lima", lote: "Q.D - L.01", parcela: "2/48", vencimento: "05/02/2026", valor: 1781.25, diasAtraso: 11, multa: 35.63, juros: 39.19, total: 1856.06 },
  { cliente: "Imobiliária XYZ Ltda", lote: "Q.B - L.02", parcela: "1/60", vencimento: "12/01/2026", valor: 825.00, diasAtraso: 35, multa: 16.50, juros: 57.75, total: 899.25 },
];

const mockContaTotais = [
  { conta: "Banco do Brasil", apelido: "BB Principal", agencia: "1234", total: 185400, qtdPagamentos: 42 },
  { conta: "Caixa Econômica", apelido: "Caixa", agencia: "5678", total: 98200, qtdPagamentos: 28 },
  { conta: "Itaú", apelido: "Itaú Emp.", agencia: "9012", total: 62800, qtdPagamentos: 15 },
];

const Relatorios = () => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [ano, setAno] = useState("2026");

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
                      {mockEntradasData.map((row) => (
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
                        <td className="px-5 py-3 text-right font-bold">{formatCurrency(mockEntradasData.reduce((s, r) => s + r.jan, 0))}</td>
                        <td className="px-5 py-3 text-right font-bold">{formatCurrency(mockEntradasData.reduce((s, r) => s + r.fev, 0))}</td>
                        <td className="px-5 py-3 text-right font-bold">{formatCurrency(mockEntradasData.reduce((s, r) => s + r.mar, 0))}</td>
                        <td className="px-5 py-3 text-right font-bold">{formatCurrency(mockEntradasData.reduce((s, r) => s + r.abr, 0))}</td>
                        <td className="px-5 py-3 text-right font-bold text-primary">{formatCurrency(mockEntradasData.reduce((s, r) => s + r.total, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {selectedReport === "atraso" && (
              <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold">Títulos em Atraso</h2>
                  <p className="text-xs text-muted-foreground mt-1">Multa: 2% + Juros: 0,20% ao dia</p>
                </div>
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
                      {mockAtrasados.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
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
