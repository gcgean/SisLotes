import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Upload, Plus, CheckCircle2, Clock, AlertTriangle, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type PagamentoSituacao = "aberto" | "pago" | "atrasado";

interface Pagamento {
  id: number;
  cliente: string;
  lote: string;
  numero_parcela: number;
  parcelas: number;
  tipo: string;
  situacao: PagamentoSituacao;
  vencimento: string;
  valor: number;
  pago_data?: string;
  valor_pago?: number;
  conta: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const parseDateBR = (dateStr: string) => {
  const [d, m, y] = dateStr.split("/").map(Number);
  return new Date(y, m - 1, d);
};

const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const calcularJuros = (valor: number, diasAtraso: number) => {
  if (diasAtraso <= 0) return { multa: 0, juros: 0, total: valor };
  const multa = valor * 0.02;
  const juros = valor * 0.002 * diasAtraso;
  return { multa, juros, total: valor + multa + juros };
};

const getDiasAtraso = (vencimentoStr: string) => {
  const venc = parseDateBR(vencimentoStr);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  venc.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

const initialPagamentos: Pagamento[] = [
  { id: 1, cliente: "João Silva", lote: "Q.A - L.02", numero_parcela: 1, parcelas: 24, tipo: "boleto", situacao: "pago", vencimento: "15/02/2026", valor: 3187.5, pago_data: "14/02/2026", valor_pago: 3187.5, conta: "Banco do Brasil" },
  { id: 2, cliente: "João Silva", lote: "Q.A - L.02", numero_parcela: 2, parcelas: 24, tipo: "boleto", situacao: "aberto", vencimento: "15/03/2026", valor: 3187.5, conta: "Banco do Brasil" },
  { id: 3, cliente: "Construtora ABC", lote: "Q.B - L.01", numero_parcela: 1, parcelas: 36, tipo: "carne", situacao: "pago", vencimento: "20/02/2026", valor: 3000, pago_data: "18/02/2026", valor_pago: 3000, conta: "Caixa" },
  { id: 4, cliente: "Construtora ABC", lote: "Q.B - L.01", numero_parcela: 2, parcelas: 36, tipo: "carne", situacao: "aberto", vencimento: "20/03/2026", valor: 3000, conta: "Caixa" },
  { id: 5, cliente: "Carlos Lima", lote: "Q.D - L.01", numero_parcela: 1, parcelas: 48, tipo: "boleto", situacao: "atrasado", vencimento: "05/01/2026", valor: 1781.25, conta: "Itaú" },
  { id: 6, cliente: "Carlos Lima", lote: "Q.D - L.01", numero_parcela: 2, parcelas: 48, tipo: "boleto", situacao: "atrasado", vencimento: "05/02/2026", valor: 1781.25, conta: "Itaú" },
  { id: 7, cliente: "Pedro Souza", lote: "Q.D - L.02", numero_parcela: 1, parcelas: 36, tipo: "boleto", situacao: "pago", vencimento: "03/03/2026", valor: 2750, pago_data: "01/03/2026", valor_pago: 2750, conta: "Banco do Brasil" },
  { id: 8, cliente: "Pedro Souza", lote: "Q.D - L.02", numero_parcela: 2, parcelas: 36, tipo: "boleto", situacao: "aberto", vencimento: "03/04/2026", valor: 2750, conta: "Banco do Brasil" },
  { id: 9, cliente: "Imobiliária XYZ Ltda", lote: "Q.B - L.02", numero_parcela: 1, parcelas: 60, tipo: "carne", situacao: "atrasado", vencimento: "12/01/2026", valor: 825, conta: "Caixa" },
  { id: 10, cliente: "Imobiliária XYZ Ltda", lote: "Q.B - L.02", numero_parcela: 2, parcelas: 60, tipo: "carne", situacao: "aberto", vencimento: "12/03/2026", valor: 825, conta: "Caixa" },
];

const situacaoConfig: Record<PagamentoSituacao, { label: string; icon: typeof CheckCircle2; colorClass: string }> = {
  pago: { label: "Pago", icon: CheckCircle2, colorClass: "text-success" },
  aberto: { label: "Aberto", icon: Clock, colorClass: "text-info" },
  atrasado: { label: "Atrasado", icon: AlertTriangle, colorClass: "text-warning" },
};

const contas = ["Banco do Brasil", "Caixa", "Itaú"];

const Pagamentos = () => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(initialPagamentos);
  const [search, setSearch] = useState("");
  const [filterSituacao, setFilterSituacao] = useState<"all" | PagamentoSituacao>("all");
  const [filterTipo, setFilterTipo] = useState("all");

  // Baixa manual state
  const [baixaOpen, setBaixaOpen] = useState(false);
  const [selectedPag, setSelectedPag] = useState<Pagamento | null>(null);
  const [baixaData, setBaixaData] = useState(todayStr());
  const [baixaValorPago, setBaixaValorPago] = useState("");
  const [baixaConta, setBaixaConta] = useState("");

  const filtered = pagamentos.filter((p) => {
    const matchSearch = p.cliente.toLowerCase().includes(search.toLowerCase());
    const matchSituacao = filterSituacao === "all" || p.situacao === filterSituacao;
    const matchTipo = filterTipo === "all" || p.tipo === filterTipo;
    return matchSearch && matchSituacao && matchTipo;
  });

  const totalAberto = pagamentos.filter((p) => p.situacao === "aberto").length;
  const totalAtrasado = pagamentos.filter((p) => p.situacao === "atrasado").length;
  const totalPago = pagamentos.filter((p) => p.situacao === "pago").length;

  const handleOpenBaixa = (pag: Pagamento) => {
    const dias = getDiasAtraso(pag.vencimento);
    const calc = calcularJuros(pag.valor, dias);
    setSelectedPag(pag);
    setBaixaData(todayStr());
    setBaixaValorPago(calc.total.toFixed(2));
    setBaixaConta(pag.conta);
    setBaixaOpen(true);
  };

  const handleConfirmarBaixa = () => {
    if (!selectedPag) return;
    const valorPago = parseFloat(baixaValorPago);
    if (isNaN(valorPago) || valorPago <= 0) {
      toast({ title: "Erro", description: "Informe um valor válido.", variant: "destructive" });
      return;
    }
    if (!baixaData.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      toast({ title: "Erro", description: "Data inválida. Use dd/mm/aaaa.", variant: "destructive" });
      return;
    }

    setPagamentos((prev) =>
      prev.map((p) =>
        p.id === selectedPag.id
          ? { ...p, situacao: "pago" as PagamentoSituacao, pago_data: baixaData, valor_pago: valorPago, conta: baixaConta }
          : p
      )
    );
    setBaixaOpen(false);
    setSelectedPag(null);
    toast({ title: "Baixa realizada", description: `Parcela ${selectedPag.numero_parcela}/${selectedPag.parcelas} de ${selectedPag.cliente} baixada com sucesso.` });
  };

  const diasAtrasoSelected = selectedPag ? getDiasAtraso(selectedPag.vencimento) : 0;
  const calcSelected = selectedPag ? calcularJuros(selectedPag.valor, diasAtrasoSelected) : null;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalPago} pagos · {totalAberto} em aberto · {totalAtrasado} atrasados
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Retorno Bancário
            </Button>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Lançamento Manual
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { situacao: "aberto" as PagamentoSituacao, total: pagamentos.filter(p => p.situacao === "aberto").reduce((s, p) => s + p.valor, 0) },
            { situacao: "atrasado" as PagamentoSituacao, total: pagamentos.filter(p => p.situacao === "atrasado").reduce((s, p) => s + p.valor, 0) },
            { situacao: "pago" as PagamentoSituacao, total: pagamentos.filter(p => p.situacao === "pago").reduce((s, p) => s + (p.valor_pago || 0), 0) },
          ]).map(({ situacao, total }) => {
            const config = situacaoConfig[situacao];
            const Icon = config.icon;
            return (
              <div key={situacao} className="glass-card rounded-lg p-4 flex items-center gap-4">
                <div className={`p-2.5 rounded-lg bg-muted ${config.colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{config.label}</p>
                  <p className="text-lg font-bold">{formatCurrency(total)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="carne">Carnê</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            {(["all", "aberto", "atrasado", "pago"] as const).map((s) => (
              <Button
                key={s}
                variant={filterSituacao === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSituacao(s)}
              >
                {s === "all" ? "Todos" : situacaoConfig[s].label}
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
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcela</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Pago em</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Conta</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Situação</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((pag) => {
                  const config = situacaoConfig[pag.situacao];
                  const Icon = config.icon;
                  return (
                    <tr key={pag.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium">{pag.cliente}</td>
                      <td className="px-5 py-3 text-muted-foreground">{pag.lote}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {pag.numero_parcela}/{pag.parcelas}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {pag.tipo}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{pag.vencimento}</td>
                      <td className="px-5 py-3 font-medium">{formatCurrency(pag.valor)}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {pag.pago_data || "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{pag.conta}</td>
                      <td className="px-5 py-3">
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${config.colorClass}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {config.label}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {pag.situacao !== "pago" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-7"
                            onClick={() => handleOpenBaixa(pag)}
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                            Baixar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum pagamento encontrado
            </div>
          )}
        </div>
      </div>

      {/* Dialog Baixa Manual */}
      <Dialog open={baixaOpen} onOpenChange={setBaixaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Baixa Manual de Parcela</DialogTitle>
            <DialogDescription>
              Registrar pagamento da parcela selecionada
            </DialogDescription>
          </DialogHeader>

          {selectedPag && calcSelected && (
            <div className="space-y-4">
              {/* Resumo da parcela */}
              <div className="glass-card rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{selectedPag.cliente}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lote</span>
                  <span>{selectedPag.lote}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Parcela</span>
                  <span>{selectedPag.numero_parcela}/{selectedPag.parcelas}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vencimento</span>
                  <span>{selectedPag.vencimento}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor original</span>
                  <span className="font-medium">{formatCurrency(selectedPag.valor)}</span>
                </div>

                {diasAtrasoSelected > 0 && (
                  <>
                    <div className="border-t border-border pt-2 mt-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-destructive">Dias em atraso</span>
                      <span className="text-destructive font-medium">{diasAtrasoSelected} dias</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Multa (2%)</span>
                      <span>{formatCurrency(calcSelected.multa)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Juros (0,20%/dia)</span>
                      <span>{formatCurrency(calcSelected.juros)}</span>
                    </div>
                    <div className="border-t border-border pt-2 mt-2" />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Total com encargos</span>
                      <span className="text-warning">{formatCurrency(calcSelected.total)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Campos da baixa */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Data do Pagamento</Label>
                  <Input
                    value={baixaData}
                    onChange={(e) => setBaixaData(e.target.value)}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor Pago (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={baixaValorPago}
                    onChange={(e) => setBaixaValorPago(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Conta Bancária</Label>
                  <Select value={baixaConta} onValueChange={setBaixaConta}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {contas.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBaixaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarBaixa} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Confirmar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Pagamentos;
