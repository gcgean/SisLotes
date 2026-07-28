import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatDateBR } from "@/lib/date-br";

interface Lancamento {
  id_lancamento: number;
  id_conta: number;
  id_loteamento?: number | null;
  tipo: "receita" | "despesa";
  id_conta_contabil?: number | null;
  descricao: string;
  valor: string;
  data: string;
}

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
  codigo: string;
  nome: string;
  tipo: "receita" | "despesa";
  ativo: boolean;
}

const emptyForm = {
  id_conta: "",
  id_loteamento: "",
  tipo: "receita" as "receita" | "despesa",
  id_conta_contabil: "",
  descricao: "",
  valor: "",
  data: new Date().toISOString().slice(0, 10),
};

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function LancamentosTab() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

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

  const contaNome = (id: number) => contas.find((c) => c.id_conta === id)?.apelido ?? `#${id}`;
  const loteamentoNome = (id?: number | null) => (id ? loteamentos.find((l) => l.id_loteamento === id)?.nome ?? `#${id}` : null);
  const contaContabilNome = (id?: number | null) =>
    id ? planoContas.find((p) => p.id_conta_contabil === id)?.nome ?? null : null;
  const contaContabilOptions = planoContas
    .filter((p) => p.ativo && p.tipo === form.tipo)
    .slice()
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        id_conta: Number(form.id_conta),
        id_loteamento: form.id_loteamento ? Number(form.id_loteamento) : null,
        tipo: form.tipo,
        id_conta_contabil: form.id_conta_contabil ? Number(form.id_conta_contabil) : null,
        descricao: form.descricao.trim(),
        valor: Number(form.valor.replace(",", ".")),
        data: form.data,
      };
      const url = editingId ? `/api/lancamentos/${editingId}` : "/api/lancamentos";
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Erro ao salvar lançamento");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      setDialogOpen(false);
      toast({ title: editingId ? "Lançamento atualizado" : "Lançamento criado" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
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
    setEditingId(null);
    setForm({ ...emptyForm, id_conta: contas[0] ? String(contas[0].id_conta) : "" });
    setDialogOpen(true);
  }

  function openEdit(l: Lancamento) {
    setEditingId(l.id_lancamento);
    setForm({
      id_conta: String(l.id_conta),
      id_loteamento: l.id_loteamento ? String(l.id_loteamento) : "",
      tipo: l.tipo,
      id_conta_contabil: l.id_conta_contabil ? String(l.id_conta_contabil) : "",
      descricao: l.descricao,
      valor: l.valor,
      data: l.data.slice(0, 10),
    });
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
        <p className="text-xs text-muted-foreground">Cadastre uma conta em Configurações antes de lançar.</p>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Descrição</th>
              <th className="px-4 py-3 text-left font-semibold">Conta</th>
              <th className="px-4 py-3 text-left font-semibold">Loteamento</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : lancamentos.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum lançamento manual ainda.</td></tr>
            ) : (
              lancamentos.map((l) => (
                <tr key={l.id_lancamento} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateBR(l.data, l.data)}</td>
                  <td className="px-4 py-3">
                    {l.tipo === "receita" ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                        <ArrowUpCircle className="h-3 w-3" /> Receita
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <ArrowDownCircle className="h-3 w-3" /> Despesa
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
                  <td className="px-4 py-3 text-muted-foreground">{loteamentoNome(l.id_loteamento) ?? "—"}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar lançamento" : "Novo lançamento manual"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: "receita" | "despesa") => setForm((f) => ({ ...f, tipo: v, id_conta_contabil: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} required />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Aluguel de terreno, taxa bancária…"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Conta *</Label>
                <Select value={form.id_conta} onValueChange={(v) => setForm((f) => ({ ...f, id_conta: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id_conta} value={String(c.id_conta)}>{c.apelido}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  inputMode="decimal"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Loteamento (opcional)</Label>
                <Select
                  value={form.id_loteamento || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, id_loteamento: v === "none" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (administrativo)</SelectItem>
                    {loteamentos.map((l) => (
                      <SelectItem key={l.id_loteamento} value={String(l.id_loteamento)}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conta contábil (opcional)</Label>
                <Select
                  value={form.id_conta_contabil || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, id_conta_contabil: v === "none" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {contaContabilOptions.map((p) => (
                      <SelectItem key={p.id_conta_contabil} value={String(p.id_conta_contabil)}>
                        {p.codigo} — {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending || !form.id_conta}>
                {saveMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
