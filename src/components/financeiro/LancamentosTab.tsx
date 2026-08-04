import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatDateBR } from "@/lib/date-br";
import { LancamentoDialog, Lancamento } from "@/components/financeiro/LancamentoDialog";

interface Conta {
  id_conta: number;
  apelido: string;
  ativo: boolean;
}

interface MovimentoGeral {
  data: string;
  movimento: "entrada" | "saida";
  origem: "venda" | "despesa" | "lancamento";
  descricao: string;
  valor: number;
  contaContabil: string | null;
  contaApelido: string;
  idConta: number;
  idLancamento: number | null;
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
  venda: "Recebimento de venda",
  despesa: "Pagamento de despesa",
  lancamento: "Lançamento manual",
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const { data: extrato, isLoading } = useQuery<ExtratoGeral>({
    queryKey: ["financeiro", "extrato-geral", from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
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

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(idLancamento: number) {
    const l = lancamentos.find((x) => x.id_lancamento === idLancamento);
    if (!l) return;
    setEditing(l);
    setDialogOpen(true);
  }

  const movimentos = extrato?.movimentos ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
        </div>
        <Button onClick={openNew} className="gap-2" disabled={contas.length === 0}>
          <Plus className="h-4 w-4" /> Novo Lançamento
        </Button>
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
            <div className="text-xs text-muted-foreground">Saldo atual geral</div>
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
              <th className="px-4 py-3 text-right font-semibold">Saldo</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-muted/20">
              <td colSpan={4} className="px-4 py-2 text-xs text-muted-foreground italic">
                Saldo inicial do período
              </td>
              <td className="px-4 py-2 text-right text-xs font-semibold" colSpan={2}>
                {extrato ? fmt(extrato.saldoInicialPeriodo) : "—"}
              </td>
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
                  <td className="px-4 py-3 text-right font-medium">{fmt(m.saldo)}</td>
                  <td className="px-4 py-3">
                    {m.origem === "lancamento" && m.idLancamento !== null && (
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
                  </td>
                </tr>
              ))
            )}
            {extrato && movimentos.length > 0 && (
              <tr className="bg-muted/20 font-semibold">
                <td colSpan={4} className="px-4 py-2 text-xs text-muted-foreground italic">
                  Saldo final do período
                </td>
                <td className="px-4 py-2 text-right text-xs" colSpan={2}>
                  {fmt(extrato.saldoFinalPeriodo)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LancamentoDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={Boolean(deletingId)} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita e vai afetar o saldo da conta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
