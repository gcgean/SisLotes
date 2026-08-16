import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
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
import { RateioLoteamentoEditor, RateioLinha } from "@/components/financeiro/RateioLoteamentoEditor";

export interface LancamentoRateioItem {
  id_loteamento: number;
  percentual: string;
  loteamento_nome?: string;
}

export interface Lancamento {
  id_lancamento: number;
  id_conta: number;
  id_loteamento?: number | null;
  tipo: "receita" | "despesa";
  id_conta_contabil?: number | null;
  id_fornecedor?: number | null;
  descricao: string;
  valor: string;
  data: string;
  rateio?: LancamentoRateioItem[];
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
  id_pai: number | null;
  codigo: string;
  nome: string;
  tipo: "receita" | "despesa";
  ativo: boolean;
}
interface Fornecedor {
  id_fornecedor: number;
  nome: string;
  ativo: boolean;
}

const emptyForm = {
  id_conta: "",
  id_loteamento: "",
  tipo: "receita" as "receita" | "despesa",
  id_conta_contabil: "",
  id_fornecedor: "",
  descricao: "",
  valor: "",
  data: new Date().toISOString().slice(0, 10),
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Lancamento | null;
  contaPadraoId?: number;
}

export function LancamentoDialog({ open, onOpenChange, editing, contaPadraoId }: Props) {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [form, setForm] = useState(emptyForm);
  const [ratear, setRatear] = useState(false);
  const [rateio, setRateio] = useState<RateioLinha[]>([]);

  const { data: contas = [] } = useQuery<Conta[]>({
    queryKey: ["financeiro", "contas-ativas"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/contas?ativo=true", { headers });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: loteamentos = [] } = useQuery<Loteamento[]>({
    queryKey: ["loteamentos"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/loteamentos", { headers });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: planoContas = [] } = useQuery<PlanoConta[]>({
    queryKey: ["despesas-categorias"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/despesas/plano-de-contas", { headers });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: fornecedores = [] } = useQuery<Fornecedor[]>({
    queryKey: ["despesas-fornecedores"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/despesas/fornecedores?ativo=true", { headers });
      if (!r.ok) return [];
      return r.json();
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        id_conta: String(editing.id_conta),
        id_loteamento: editing.id_loteamento ? String(editing.id_loteamento) : "",
        tipo: editing.tipo,
        id_conta_contabil: editing.id_conta_contabil ? String(editing.id_conta_contabil) : "",
        id_fornecedor: editing.id_fornecedor ? String(editing.id_fornecedor) : "",
        descricao: editing.descricao,
        valor: editing.valor,
        data: editing.data.slice(0, 10),
      });
      const temRateio = Boolean(editing.rateio && editing.rateio.length > 0);
      setRatear(temRateio);
      setRateio(
        temRateio
          ? editing.rateio!.map((r) => ({ id_loteamento: String(r.id_loteamento), percentual: String(Number(r.percentual)) }))
          : []
      );
    } else {
      setForm({ ...emptyForm, id_conta: contaPadraoId ? String(contaPadraoId) : contas[0] ? String(contas[0].id_conta) : "" });
      setRatear(false);
      setRateio([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, contaPadraoId, contas.length]);

  const contasSinteticas = new Set(planoContas.map((p) => p.id_pai).filter((id): id is number => id !== null));
  const contaContabilOptions: ComboboxOption[] = planoContas
    .filter((p) => p.ativo && p.tipo === form.tipo && !contasSinteticas.has(p.id_conta_contabil))
    .slice()
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
    .map((p) => ({ value: String(p.id_conta_contabil), label: `${p.codigo} — ${p.nome}` }));

  const fornecedorOptions: ComboboxOption[] = [
    { value: "none", label: "— Nenhum —" },
    ...fornecedores.filter((f) => f.ativo).map((f) => ({ value: String(f.id_fornecedor), label: f.nome })),
  ];

  const loteamentoOptions: ComboboxOption[] = [
    { value: "none", label: "Nenhum (administrativo)" },
    ...loteamentos.map((l) => ({ value: String(l.id_loteamento), label: l.nome })),
  ];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rateioPayload = ratear
        ? rateio
            .filter((r) => r.id_loteamento && r.percentual)
            .map((r) => ({ id_loteamento: Number(r.id_loteamento), percentual: Number(r.percentual.replace(",", ".")) }))
        : undefined;

      const payload = {
        id_conta: Number(form.id_conta),
        id_loteamento: ratear ? null : form.id_loteamento ? Number(form.id_loteamento) : null,
        tipo: form.tipo,
        id_conta_contabil: form.id_conta_contabil ? Number(form.id_conta_contabil) : null,
        id_fornecedor: form.id_fornecedor ? Number(form.id_fornecedor) : null,
        descricao: form.descricao.trim(),
        valor: Number(form.valor.replace(",", ".")),
        data: form.data,
        ...(rateioPayload ? { rateio: rateioPayload } : {}),
      };
      const url = editing ? `/api/lancamentos/${editing.id_lancamento}` : "/api/lancamentos";
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Erro ao salvar lançamento");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      onOpenChange(false);
      toast({ title: editing ? "Lançamento atualizado" : "Lançamento criado" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const totalRateio = rateio.reduce((s, l) => s + (Number(l.percentual.replace(",", ".")) || 0), 0);
  const rateioValido = !ratear || (rateio.length > 0 && Math.abs(totalRateio - 100) < 0.5 && rateio.every((r) => r.id_loteamento));
  const podeSalvar = Boolean(form.id_conta && form.descricao.trim() && form.valor && rateioValido);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento manual"}</DialogTitle>
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
                  <SelectItem value="receita">Crédito (entrada)</SelectItem>
                  <SelectItem value="despesa">Débito (saída)</SelectItem>
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
              <MoneyInput
                value={form.valor}
                onValueChange={(valor) => setForm((f) => ({ ...f, valor }))}
                placeholder="R$ 0,00"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Conta contábil (opcional)</Label>
              <Combobox
                options={[{ value: "none", label: "Nenhuma" }, ...contaContabilOptions]}
                value={form.id_conta_contabil || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, id_conta_contabil: v === "none" ? "" : v }))}
                placeholder="Nenhuma"
                searchPlaceholder="Buscar conta contábil..."
              />
            </div>
            <div>
              <Label>Fornecedor (opcional)</Label>
              <Combobox
                options={fornecedorOptions}
                value={form.id_fornecedor || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, id_fornecedor: v === "none" ? "" : v }))}
                placeholder="— Nenhum —"
                searchPlaceholder="Buscar fornecedor..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border p-2 bg-muted/30">
            <Switch checked={ratear} onCheckedChange={(v) => { setRatear(v); if (v && rateio.length === 0) setRateio([{ id_loteamento: form.id_loteamento, percentual: "100" }]); }} />
            <Label className="cursor-pointer flex-1" onClick={() => setRatear((v) => !v)}>
              Ratear entre loteamentos
            </Label>
          </div>

          {ratear ? (
            <div>
              <Label className="mb-1.5 block">Rateio por loteamento</Label>
              <RateioLoteamentoEditor loteamentos={loteamentos} value={rateio} onChange={setRateio} />
            </div>
          ) : (
            <div>
              <Label>Loteamento (opcional)</Label>
              <Combobox
                options={loteamentoOptions}
                value={form.id_loteamento || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, id_loteamento: v === "none" ? "" : v }))}
                placeholder="Nenhum"
                searchPlaceholder="Buscar loteamento..."
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMutation.isPending || !podeSalvar}>
              {saveMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
