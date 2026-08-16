import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Flame, LockKeyhole, PiggyBank, Scale, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmationDialog } from "@/components/ui/destructive-confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDateBR } from "@/lib/date-br";

interface ExtratoFechamento {
  periodo: { from: string; to: string };
  saldoInicial: number; entradas: number; saidas: number; saldoFinal: number; variacaoCaixa: number;
  contasReceberPendentes: number; qtdReceberPendentes: number;
  contasPagarPendentes: number; qtdPagarPendentes: number; saldoNaoConsolidado: number;
}

const hoje = new Date();
const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
const moeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export function FechamentoPeriodoTab() {
  const { token } = useAuth(); const { toast } = useToast(); const queryClient = useQueryClient();
  const [data, setData] = useState(""); const [confirmar, setConfirmar] = useState(false);
  const [periodo, setPeriodo] = useState({ from: inicioMes, to: dataHoje });
  const [periodoAplicado, setPeriodoAplicado] = useState({ from: inicioMes, to: dataHoje });
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data: config } = useQuery<{ fechado_ate: string | null }>({ queryKey: ["fechamento-financeiro"], queryFn: async () => { const response = await fetch("/api/fechamento-financeiro", { headers }); if (!response.ok) throw new Error("Erro ao carregar fechamento"); return response.json(); } });
  useEffect(() => setData(config?.fechado_ate ?? ""), [config?.fechado_ate]);
  const extrato = useQuery<ExtratoFechamento>({ queryKey: ["fechamento-financeiro", "extrato", periodoAplicado.from, periodoAplicado.to], queryFn: async () => { const params = new URLSearchParams(periodoAplicado); const response = await fetch(`/api/fechamento-financeiro/extrato?${params}`, { headers }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Erro ao carregar extrato do fechamento"); return body; } });
  const salvar = useMutation({ mutationFn: async () => { const response = await fetch("/api/fechamento-financeiro", { method: "PUT", headers, body: JSON.stringify({ fechado_ate: data || null }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Erro ao salvar fechamento"); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fechamento-financeiro"] }); setConfirmar(false); toast({ title: data ? "Período fechado" : "Fechamento removido" }); }, onError: (error: Error) => toast({ title: error.message, variant: "destructive" }) });
  const dados = extrato.data; const acumulou = (dados?.variacaoCaixa ?? 0) >= 0;

  return <div className="space-y-4">
    <div className="rounded-lg border p-5 space-y-4">
      <div className="flex items-start gap-3"><div className="rounded-lg bg-muted p-2 text-primary"><LockKeyhole className="h-5 w-5" /></div><div><h2 className="font-semibold">Fechamento de período</h2><p className="text-sm text-muted-foreground">Impede lançamentos, baixas, edições, exclusões e estornos com data igual ou anterior ao fechamento.</p></div></div>
      {config?.fechado_ate ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Período atualmente fechado até <strong>{formatDateBR(config.fechado_ate)}</strong>.</div> : <div className="rounded-md border p-3 text-sm text-muted-foreground">Nenhum período está fechado.</div>}
      <div className="max-w-xs"><Label>Fechar até</Label><Input type="date" value={data} onChange={(event) => setData(event.target.value)} /></div>
      <div className="flex gap-2"><Button disabled={!data || data === config?.fechado_ate} onClick={() => setConfirmar(true)}>Aplicar fechamento</Button>{config?.fechado_ate ? <Button variant="outline" disabled={salvar.isPending} onClick={() => { setData(""); setConfirmar(true); }}>Remover fechamento</Button> : null}</div>
    </div>
    <div className="rounded-lg border p-5 space-y-5">
      <div><h2 className="font-semibold">Extrato do fechamento</h2><p className="text-sm text-muted-foreground">Resumo consolidado do caixa realizado e dos compromissos ainda pendentes no período.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>Início do período</Label><Input type="date" value={periodo.from} onChange={(event) => setPeriodo((atual) => ({ ...atual, from: event.target.value }))} /></div>
        <div><Label>Fim do período</Label><Input type="date" value={periodo.to} onChange={(event) => setPeriodo((atual) => ({ ...atual, to: event.target.value }))} /></div>
        <Button variant="outline" disabled={!periodo.from || !periodo.to || periodo.from > periodo.to} onClick={() => setPeriodoAplicado(periodo)}>Atualizar extrato</Button>
      </div>
      {extrato.isLoading ? <LoadingState message="Calculando extrato do fechamento…" /> : extrato.isError ? <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(extrato.error as Error).message}</div> : dados ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ResumoCard icon={WalletCards} label="Saldo inicial" value={dados.saldoInicial} detail="Todas as contas no início do período" /><ResumoCard icon={ArrowUpCircle} label="Entradas" value={dados.entradas} detail="Receitas realizadas no período" tone="positive" /><ResumoCard icon={ArrowDownCircle} label="Saídas" value={dados.saidas} detail="Despesas realizadas no período" tone="negative" /><ResumoCard icon={PiggyBank} label="Saldo final" value={dados.saldoFinal} detail="Saldo consolidado ao fim do período" /></div>
        <div className={`rounded-lg border p-4 ${acumulou ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"}`}><div className="flex items-start gap-3">{acumulou ? <PiggyBank className="h-5 w-5 text-emerald-600" /> : <Flame className="h-5 w-5 text-red-600" />}<div><p className="font-semibold">{acumulou ? "O período acumulou caixa" : "O período queimou caixa"}</p><p className="text-sm text-muted-foreground">Entradas menos saídas: <strong className={acumulou ? "text-emerald-700" : "text-red-700"}>{moeda(dados.variacaoCaixa)}</strong>.</p></div></div></div>
        <div className="grid gap-3 sm:grid-cols-3"><ResumoCard icon={ArrowUpCircle} label="A receber não recebido" value={dados.contasReceberPendentes} detail={`${dados.qtdReceberPendentes} parcela(s) vencendo no período`} tone="positive" /><ResumoCard icon={ArrowDownCircle} label="A pagar não pago" value={dados.contasPagarPendentes} detail={`${dados.qtdPagarPendentes} parcela(s) vencendo no período`} tone="negative" /><ResumoCard icon={Scale} label="Ainda não consolidado" value={dados.saldoNaoConsolidado} detail="A receber pendente menos a pagar pendente" /></div>
      </> : null}
    </div>
    <DestructiveConfirmationDialog open={confirmar} onOpenChange={setConfirmar} title={data ? "Confirmar fechamento do período?" : "Remover fechamento do período?"} description={data ? `Operações financeiras com data até ${formatDateBR(data)} serão bloqueadas.` : "Operações retroativas voltarão a ser permitidas."} consequence="Registros históricos não serão alterados. A mudança ficará registrada na auditoria." confirmLabel={data ? "Fechar período" : "Remover fechamento"} pending={salvar.isPending} onConfirm={() => salvar.mutate()} />
  </div>;
}

function ResumoCard({ icon: Icon, label, value, detail, tone }: { icon: typeof WalletCards; label: string; value: number; detail: string; tone?: "positive" | "negative" }) {
  const color = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-foreground";
  return <div className="rounded-lg border p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className={`mt-2 text-xl font-bold ${color}`}>{moeda(value)}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}
