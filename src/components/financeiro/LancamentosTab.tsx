import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, Split } from "lucide-react";
import { formatDateBR } from "@/lib/date-br";
import { LancamentoDialog, Lancamento } from "@/components/financeiro/LancamentoDialog";

interface Conta {
  id_conta: number;
  apelido: string;
  ativo: boolean;
}
interface Loteamento {
  id_loteamento: number;
  nome: string;
}
interface PlanoConta {
  id_conta_contabil: number;
  nome: string;
}
interface Fornecedor {
  id_fornecedor: number;
  nome: string;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function LancamentosTab() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}` };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: lancamentos = [], isLoading } = useQuery<Lancamento[]>({
    queryKey: ["financeiro", "lancamentos"],
    queryFn: async () => {
      const r = await fetch("/api/lancamentos", { headers });
      if (!r.ok) throw new Error("Erro ao carregar lançamentos");
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

  const { data: loteamentos = [] } = useQuery<Loteamento[]>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const r = await fetch("/api/loteamentos", { headers });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: planoContas = [] } = useQuery<PlanoConta[]>({
    queryKey: ["despesas-categorias"],
    queryFn: async () => {
      const r = await fetch("/api/despesas/plano-de-contas", { headers });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: fornecedores = [] } = useQuery<Fornecedor[]>({
    queryKey: ["despesas-fornecedores"],
    queryFn: async () => {
      const r = await fetch("/api/despesas/fornecedores", { headers });
      if (!r.ok) return [];
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

  const contaNome = (id: number) => contas.find((c) => c.id_conta === id)?.apelido ?? `#${id}`;
  const loteamentoNome = (id?: number | null) => (id ? loteamentos.find((l) => l.id_loteamento === id)?.nome ?? `#${id}` : null);
  const contaContabilNome = (id?: number | null) => (id ? planoContas.find((p) => p.id_conta_contabil === id)?.nome ?? null : null);
  const fornecedorNome = (id?: number | null) => (id ? fornecedores.find((f) => f.id_fornecedor === id)?.nome ?? null : null);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(l: Lancamento) {
    setEditing(l);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-2" disabled={contas.length === 0}>
          <Plus className="h-4 w-4" /> Novo Lançamento
        </Button>
      </div>
      {contas.length === 0 && (
        <p className="text-xs text-muted-foreground">Cadastre uma conta na aba "Contas" antes de lançar.</p>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Descrição</th>
              <th className="px-4 py-3 text-left font-semibold">Conta</th>
              <th className="px-4 py-3 text-left font-semibold">Fornecedor</th>
              <th className="px-4 py-3 text-left font-semibold">Loteamento</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : lancamentos.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum lançamento manual ainda.</td></tr>
            ) : (
              lancamentos.map((l) => {
                const temRateio = Boolean(l.rateio && l.rateio.length > 0);
                return (
                  <tr key={l.id_lancamento} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateBR(l.data, l.data)}</td>
                    <td className="px-4 py-3">
                      {l.tipo === "receita" ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                          <ArrowUpCircle className="h-3 w-3" /> Crédito
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <ArrowDownCircle className="h-3 w-3" /> Débito
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {l.descricao}
                      {contaContabilNome(l.id_conta_contabil) && (
                        <div className="text-xs text-muted-foreground">{contaContabilNome(l.id_conta_contabil)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{contaNome(l.id_conta)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fornecedorNome(l.id_fornecedor) ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {temRateio ? (
                        <Badge variant="outline" className="gap-1">
                          <Split className="h-3 w-3" /> {l.rateio!.length} loteamentos
                        </Badge>
                      ) : (
                        loteamentoNome(l.id_loteamento) ?? "—"
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${l.tipo === "receita" ? "text-emerald-600" : "text-red-500"}`}>
                      {fmt(Number(l.valor))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(l)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingId(l.id_lancamento)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
