import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DestructiveConfirmationDialog } from "@/components/ui/destructive-confirmation-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Printer, Download, Search, ArrowRightLeft } from "lucide-react";
import { formatDateBR } from "@/lib/date-br";
import { LancamentoDialog, Lancamento } from "@/components/financeiro/LancamentoDialog";
import { TransferenciaDialog, TransferenciaConta } from "@/components/financeiro/TransferenciaDialog";
import { imprimirExtratoConta } from "@/utils/extratoConta";
import type { ReciboEmpresa } from "@/utils/reciboParcela";

interface Conta {
  id_conta: number;
  apelido: string;
  ativo: boolean;
}

interface MovimentoGeral {
  data: string;
  movimento: "entrada" | "saida";
  origem: "recebimento" | "pagamento" | "manual" | "transferencia";
  descricao: string;
  valor: number;
  contaContabil: string | null;
  contaApelido: string;
  idConta: number;
  idLancamento: number | null;
  idTransferencia: number | null;
  saldo: number;
}

interface ExtratoGeral {
  saldoInicialPeriodo: number;
  saldoFinalPeriodo: number;
  totalCreditos: number;
  totalDebitos: number;
  saldoAtualGeral: number;
  movimentos: MovimentoGeral[];
}

const ORIGEM_LABEL: Record<string, string> = {
  recebimento: "Recebimento de venda",
  pagamento: "Pagamento de despesa",
  manual: "Lançamento manual",
  transferencia: "Transferência entre contas",
};

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function primeiroDiaMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export function LancamentosTab() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}` };

  const [from, setFrom] = useState(primeiroDiaMes());
  const [to, setTo] = useState(hojeIso());
  const [contaFiltro, setContaFiltro] = useState<string>("todas");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [previewIaLancamento, setPreviewIaLancamento] = useState<Record<string, string> | undefined>();
  const [transferenciaOpen, setTransferenciaOpen] = useState(false);
  const [editingTransferencia, setEditingTransferencia] = useState<TransferenciaConta | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingTransferenciaId, setDeletingTransferenciaId] = useState<number | null>(null);
  const [usarTimbrado, setUsarTimbrado] = useState(true);

  // ── Proposta vinda do assistente de IA: abre o lançamento já preenchido para
  // o usuário conferir e confirmar. A IA nunca grava — a gravação é este submit.
  const propostaLancamentoAplicadaRef = useRef(false);
  useEffect(() => {
    if (propostaLancamentoAplicadaRef.current) return;
    if (searchParams.get("tab") !== "lancamentos" || searchParams.get("novo") !== "1") return;
    propostaLancamentoAplicadaRef.current = true;

    const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? String(Number(v)) : "");
    setEditing(null);
    setPreviewIaLancamento({
      tipo: searchParams.get("tipo") === "despesa" ? "despesa" : "receita",
      descricao: searchParams.get("descricao") ?? "",
      valor: num(searchParams.get("valor")),
      data: searchParams.get("data") ?? hojeIso(),
      id_conta: num(searchParams.get("id_conta")),
      id_conta_contabil: num(searchParams.get("id_conta_contabil")),
      id_loteamento: num(searchParams.get("id_loteamento")),
    });
    setDialogOpen(true);

    const limpos = new URLSearchParams(searchParams);
    ["novo", "tipo", "descricao", "valor", "data", "id_conta", "id_conta_contabil", "id_loteamento"].forEach((k) =>
      limpos.delete(k),
    );
    setSearchParams(limpos, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: empresaInfo } = useQuery<ReciboEmpresa>({
    queryKey: ["minha-empresa"],
    queryFn: async () => {
      const r = await fetch("/api/empresas/minha", { headers });
      if (!r.ok) throw new Error("Erro ao carregar empresa");
      return r.json();
    },
  });

  const { data: contas = [] } = useQuery<Conta[]>({
    queryKey: ["financeiro", "contas-ativas"],
    queryFn: async () => {
      const r = await fetch("/api/contas?ativo=true", { headers });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Fonte dos dados de edição/exclusão (só lançamentos manuais podem ser alterados).
  const { data: lancamentos = [] } = useQuery<Lancamento[]>({
    queryKey: ["financeiro", "lancamentos"],
    queryFn: async () => {
      const r = await fetch("/api/lancamentos", { headers });
      if (!r.ok) throw new Error("Erro ao carregar lançamentos");
      return r.json();
    },
  });

  const { data: transferencias = [] } = useQuery<TransferenciaConta[]>({
    queryKey: ["financeiro", "transferencias"],
    queryFn: async () => {
      const r = await fetch("/api/lancamentos/transferencias", { headers });
      if (!r.ok) throw new Error("Erro ao carregar transferências");
      return r.json();
    },
  });

  const { data: extrato, isLoading } = useQuery<ExtratoGeral>({
    queryKey: ["financeiro", "extrato-geral", from, to, contaFiltro],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (contaFiltro !== "todas") params.set("id_conta", contaFiltro);
      const r = await fetch(`/api/contas/extrato-geral?${params.toString()}`, { headers });
      if (!r.ok) throw new Error("Erro ao carregar extrato");
      return r.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/lancamentos/${id}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error("Erro ao excluir lançamento");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      setDeletingId(null);
      toast({ title: "Lançamento excluído" });
    },
    onError: () => toast({ title: "Erro ao excluir lançamento", variant: "destructive" }),
  });

  const deleteTransferenciaMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/lancamentos/transferencias/${id}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error("Erro ao excluir transferência");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      setDeletingTransferenciaId(null);
      toast({ title: "Transferência excluída" });
    },
    onError: () => toast({ title: "Erro ao excluir transferência", variant: "destructive" }),
  });

  function openNew() {
    setEditing(null);
    setPreviewIaLancamento(undefined);
    setDialogOpen(true);
  }
  function openEdit(idLancamento: number) {
    const l = lancamentos.find((x) => x.id_lancamento === idLancamento);
    if (!l) return;
    setEditing(l);
    setPreviewIaLancamento(undefined);
    setDialogOpen(true);
  }
  function openEditTransferencia(idTransferencia: number) {
    const transferencia = transferencias.find((item) => item.id_transferencia === idTransferencia);
    if (!transferencia) return;
    setEditingTransferencia(transferencia);
    setTransferenciaOpen(true);
  }

  const movimentos = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return (extrato?.movimentos ?? []).filter((movimento) =>
      (tipoFiltro === "todos" || movimento.movimento === tipoFiltro) &&
      (!termo || movimento.descricao.toLocaleLowerCase("pt-BR").includes(termo) || movimento.contaApelido.toLocaleLowerCase("pt-BR").includes(termo) || (movimento.contaContabil ?? "").toLocaleLowerCase("pt-BR").includes(termo))
    );
  }, [extrato, busca, tipoFiltro]);
  const lancamentoExcluido = deletingId ? lancamentos.find((item) => item.id_lancamento === deletingId) : null;
  const transferenciaExcluida = deletingTransferenciaId ? transferencias.find((item) => item.id_transferencia === deletingTransferenciaId) : null;
  const exibirSaldoCorrente = contaFiltro !== "todas";

  const contaLabel =
    contaFiltro === "todas"
      ? "Todas as contas"
      : contas.find((c) => String(c.id_conta) === contaFiltro)?.apelido ?? "Conta";

  function imprimirExtrato() {
    if (!extrato) return;
    const ok = imprimirExtratoConta(
      {
        contaLabel,
        periodoDe: from,
        periodoAte: to,
        saldoInicialPeriodo: extrato.saldoInicialPeriodo,
        saldoFinalPeriodo: extrato.saldoFinalPeriodo,
        totalCreditos: extrato.totalCreditos,
        totalDebitos: extrato.totalDebitos,
        movimentos: extrato.movimentos,
      },
      empresaInfo ?? null,
      usarTimbrado,
    );
    if (!ok) {
      toast({
        title: "Não foi possível abrir a impressão",
        description: "Verifique se o bloqueador de pop-ups está desativado.",
        variant: "destructive",
      });
    }
  }

  function exportarCsv() {
    const linhas = [["Data", "Descrição", "Conta", "Tipo", "Valor"], ...movimentos.map((m) => [m.data, m.descricao, m.contaApelido, m.movimento, m.valor.toFixed(2).replace(".", ",")])];
    const csv = linhas.map((linha) => linha.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `extrato-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
          <Select value={contaFiltro} onValueChange={setContaFiltro}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as contas</SelectItem>
              {contas.map((c) => (
                <SelectItem key={c.id_conta} value={String(c.id_conta)}>
                  {c.apelido}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Créditos e débitos</SelectItem>
              <SelectItem value="entrada">Somente créditos</SelectItem>
              <SelectItem value="saida">Somente débitos</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição, conta ou categoria…" className="pl-9" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="timbrado-extrato" checked={usarTimbrado} onCheckedChange={setUsarTimbrado} />
            <Label htmlFor="timbrado-extrato" className="text-xs text-muted-foreground cursor-pointer">
              Com timbrado
            </Label>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={imprimirExtrato}
            disabled={!extrato || isLoading}
          >
            <Printer className="h-4 w-4" /> Imprimir Extrato
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportarCsv} disabled={movimentos.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={openNew} className="gap-2" disabled={contas.length === 0}>
            <Plus className="h-4 w-4" /> Novo Lançamento
          </Button>
          <Button variant="outline" onClick={() => { setEditingTransferencia(null); setTransferenciaOpen(true); }} className="gap-2" disabled={contas.length < 2}>
            <ArrowRightLeft className="h-4 w-4" /> Transferir
          </Button>
        </div>
      </div>
      {contas.length === 0 && (
        <p className="text-xs text-muted-foreground">Cadastre uma conta na aba "Contas" antes de lançar.</p>
      )}

      {extrato && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xs text-muted-foreground">Saldo inicial do período</div>
            <div className="text-base font-bold">{fmt(extrato.saldoInicialPeriodo)}</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xs text-muted-foreground">Créditos no período</div>
            <div className="text-base font-bold text-emerald-600">{fmt(extrato.totalCreditos)}</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xs text-muted-foreground">Débitos no período</div>
            <div className="text-base font-bold text-red-500">{fmt(extrato.totalDebitos)}</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xs text-muted-foreground">Saldo final do período</div>
            <div className={`text-base font-bold ${extrato.saldoFinalPeriodo >= 0 ? "" : "text-red-500"}`}>
              {fmt(extrato.saldoFinalPeriodo)}
            </div>
          </div>
          <div className="rounded-lg border p-3 text-center bg-muted/30">
            <div className="text-xs text-muted-foreground">
              {contaFiltro === "todas" ? "Saldo atual geral" : "Saldo atual da conta"}
            </div>
            <div className={`text-base font-bold ${extrato.saldoAtualGeral >= 0 ? "" : "text-red-500"}`}>
              {fmt(extrato.saldoAtualGeral)}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold">Descrição</th>
              <th className="px-4 py-3 text-left font-semibold">Conta</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
              {exibirSaldoCorrente ? <th className="px-4 py-3 text-right font-semibold">Saldo</th> : null}
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-muted/20">
              <td colSpan={exibirSaldoCorrente ? 4 : 5} className="px-4 py-2 text-xs text-muted-foreground italic">
                Saldo inicial do período
              </td>
              {exibirSaldoCorrente ? <td className="px-4 py-2 text-right text-xs font-semibold" colSpan={2}>{extrato ? fmt(extrato.saldoInicialPeriodo) : "—"}</td> : null}
            </tr>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : movimentos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum movimento no período.</td></tr>
            ) : (
              movimentos.map((m, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateBR(m.data, m.data)}</td>
                  <td className="px-4 py-3">
                    {m.descricao}
                    <div className="text-xs text-muted-foreground">
                      {m.contaContabil ?? ORIGEM_LABEL[m.origem] ?? m.origem}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.contaApelido}</td>
                  <td className={`px-4 py-3 text-right font-medium ${m.movimento === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                    {m.movimento === "entrada" ? "+" : "−"}{fmt(m.valor)}
                  </td>
                  {exibirSaldoCorrente ? <td className="px-4 py-3 text-right font-medium">{fmt(m.saldo)}</td> : null}
                  <td className="px-4 py-3">
                    {m.origem === "manual" && m.idLancamento !== null && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(m.idLancamento!)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingId(m.idLancamento!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {m.origem === "transferencia" && m.idTransferencia !== null && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditTransferencia(m.idTransferencia!)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingTransferenciaId(m.idTransferencia!)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
            {extrato && movimentos.length > 0 && (
              <tr className="bg-muted/20 font-semibold">
                <td colSpan={exibirSaldoCorrente ? 4 : 5} className="px-4 py-2 text-xs text-muted-foreground italic">
                  Saldo final do período
                </td>
                {exibirSaldoCorrente ? <td className="px-4 py-2 text-right text-xs" colSpan={2}>{fmt(extrato.saldoFinalPeriodo)}</td> : null}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LancamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        initialValues={previewIaLancamento}
      />
      <TransferenciaDialog open={transferenciaOpen} onOpenChange={setTransferenciaOpen} editing={editingTransferencia} />

      <DestructiveConfirmationDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Excluir lançamento manual?"
        description={lancamentoExcluido ? `${lancamentoExcluido.descricao} · ${fmt(Number(lancamentoExcluido.valor))} · ${formatDateBR(lancamentoExcluido.data)}` : "Lançamento selecionado"}
        consequence="O lançamento será removido permanentemente e o saldo da conta será recalculado."
        confirmLabel="Excluir lançamento"
        pending={deleteMutation.isPending}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
      />
      <DestructiveConfirmationDialog
        open={Boolean(deletingTransferenciaId)}
        onOpenChange={(open) => !open && setDeletingTransferenciaId(null)}
        title="Excluir transferência?"
        description={transferenciaExcluida ? `${transferenciaExcluida.conta_origem_apelido} → ${transferenciaExcluida.conta_destino_apelido} · ${fmt(Number(transferenciaExcluida.valor))} · ${formatDateBR(transferenciaExcluida.data)}` : "Transferência selecionada"}
        consequence="A saída e a entrada serão removidas juntas, recalculando o saldo das duas contas."
        confirmLabel="Excluir transferência"
        pending={deleteTransferenciaMutation.isPending}
        onConfirm={() => deletingTransferenciaId && deleteTransferenciaMutation.mutate(deletingTransferenciaId)}
      />
    </div>
  );
}
