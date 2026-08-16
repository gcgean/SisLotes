import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface TransferenciaConta {
  id_transferencia: number;
  id_conta_origem: number;
  id_conta_destino: number;
  conta_origem_apelido: string;
  conta_destino_apelido: string;
  descricao: string;
  valor: string;
  data: string;
}

interface Conta {
  id_conta: number;
  apelido: string;
  saldo_atual: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TransferenciaConta | null;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const formVazio = { id_conta_origem: "", id_conta_destino: "", descricao: "", valor: "", data: hoje() };
const moeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export function TransferenciaDialog({ open, onOpenChange, editing }: Props) {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(formVazio);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data: contas = [] } = useQuery<Conta[]>({
    queryKey: ["financeiro", "contas-ativas"],
    enabled: open,
    queryFn: async () => {
      const response = await fetch("/api/contas?ativo=true", { headers });
      if (!response.ok) throw new Error("Erro ao carregar contas");
      return response.json();
    },
  });

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      id_conta_origem: String(editing.id_conta_origem),
      id_conta_destino: String(editing.id_conta_destino),
      descricao: editing.descricao,
      valor: editing.valor,
      data: editing.data.slice(0, 10),
    } : formVazio);
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        editing ? `/api/lancamentos/transferencias/${editing.id_transferencia}` : "/api/lancamentos/transferencias",
        {
          method: editing ? "PUT" : "POST",
          headers,
          body: JSON.stringify({
            id_conta_origem: Number(form.id_conta_origem),
            id_conta_destino: Number(form.id_conta_destino),
            descricao: form.descricao.trim(),
            valor: Number(form.valor.replace(",", ".")),
            data: form.data,
          }),
        }
      );
      if (!response.ok) {
        const erro = await response.json().catch(() => ({}));
        throw new Error(erro.error || "Erro ao salvar transferência");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      onOpenChange(false);
      toast({ title: editing ? "Transferência atualizada" : "Transferência realizada" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const podeSalvar = Boolean(
    form.id_conta_origem && form.id_conta_destino &&
    form.id_conta_origem !== form.id_conta_destino && form.descricao.trim() &&
    Number(form.valor.replace(",", ".")) > 0 && form.data
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Editar transferência" : "Nova transferência"}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }}>
          <div>
            <Label>Conta de origem *</Label>
            <Select value={form.id_conta_origem} onValueChange={(value) => setForm((atual) => ({ ...atual, id_conta_origem: value }))}>
              <SelectTrigger><SelectValue placeholder="Selecione a origem…" /></SelectTrigger>
              <SelectContent>{contas.map((conta) => <SelectItem key={conta.id_conta} value={String(conta.id_conta)} disabled={String(conta.id_conta) === form.id_conta_destino}>{conta.apelido} · {moeda(conta.saldo_atual)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conta de destino *</Label>
            <Select value={form.id_conta_destino} onValueChange={(value) => setForm((atual) => ({ ...atual, id_conta_destino: value }))}>
              <SelectTrigger><SelectValue placeholder="Selecione o destino…" /></SelectTrigger>
              <SelectContent>{contas.map((conta) => <SelectItem key={conta.id_conta} value={String(conta.id_conta)} disabled={String(conta.id_conta) === form.id_conta_origem}>{conta.apelido} · {moeda(conta.saldo_atual)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor *</Label><MoneyInput value={form.valor} onValueChange={(valor) => setForm((atual) => ({ ...atual, valor }))} required /></div>
            <div><Label>Data *</Label><Input type="date" value={form.data} onChange={(event) => setForm((atual) => ({ ...atual, data: event.target.value }))} required /></div>
          </div>
          <div><Label>Descrição *</Label><Input value={form.descricao} onChange={(event) => setForm((atual) => ({ ...atual, descricao: event.target.value }))} placeholder="Ex: Transferência para tesouraria" required /></div>
          <p className="text-xs text-muted-foreground">A operação reduzirá o saldo da origem e aumentará o saldo do destino, sem alterar receitas ou despesas.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!podeSalvar || saveMutation.isPending}>{saveMutation.isPending ? "Salvando…" : "Confirmar transferência"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
