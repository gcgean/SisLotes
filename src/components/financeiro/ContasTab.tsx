import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wallet, Search } from "lucide-react";
import { formatDateBR } from "@/lib/date-br";

interface Conta {
  id_conta: number;
  apelido: string;
  tipo: "banco" | "caixa";
  titular?: string | null;
  agencia?: string | null;
  conta?: string | null;
  ativo: boolean;
  saldo_atual?: number;
}

interface Movimento {
  data: string;
  movimento: "entrada" | "saida";
  origem: "venda" | "despesa" | "lancamento";
  descricao: string;
  valor: number;
  contaContabil: string | null;
  saldo: number;
}

interface Extrato {
  conta: { id_conta: number; apelido: string; tipo: string };
  saldoInicialPeriodo: number;
  saldoFinalPeriodo: number;
  movimentos: Movimento[];
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

export function ContasTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [selecionada, setSelecionada] = useState<Conta | null>(null);
  const [from, setFrom] = useState(primeiroDiaMes());
  const [to, setTo] = useState(hojeIso());

  const { data: contas = [], isLoading } = useQuery<Conta[]>({
    queryKey: ["financeiro", "contas-todas"],
    queryFn: async () => {
      const r = await fetch("/api/contas", { headers });
      if (!r.ok) throw new Error("Erro ao carregar contas");
      return r.json();
    },
  });

  const { data: extrato, isLoading: loadingExtrato } = useQuery<Extrato>({
    queryKey: ["financeiro", "extrato", selecionada?.id_conta, from, to],
    enabled: Boolean(selecionada),
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      const r = await fetch(`/api/contas/${selecionada!.id_conta}/extrato?${params.toString()}`, { headers });
      if (!r.ok) throw new Error("Erro ao carregar extrato");
      return r.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold">Conta</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Saldo atual</th>
              <th className="px-4 py-3 text-right font-semibold">Extrato</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : contas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma conta cadastrada. Cadastre em Configurações.</td></tr>
            ) : (
              contas.map((c) => (
                <tr key={c.id_conta} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.apelido}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize">{c.tipo}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {c.ativo ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200">Ativa</Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${(c.saldo_atual ?? 0) >= 0 ? "" : "text-red-500"}`}>
                    {fmt(c.saldo_atual ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelecionada(c)}>
                      <Search className="h-3.5 w-3.5 mr-1.5" /> Ver extrato
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(selecionada)} onOpenChange={(o) => !o && setSelecionada(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600" />
              Extrato — {selecionada?.apelido}
            </DialogTitle>
            <DialogDescription>Movimentos da conta no período selecionado</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
          </div>

          {loadingExtrato ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
          ) : extrato ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border p-2">
                  <div className="text-xs text-muted-foreground">Saldo inicial</div>
                  <div className="text-lg font-bold">{fmt(extrato.saldoInicialPeriodo)}</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-xs text-muted-foreground">Saldo final</div>
                  <div className={`text-lg font-bold ${extrato.saldoFinalPeriodo >= 0 ? "" : "text-red-500"}`}>
                    {fmt(extrato.saldoFinalPeriodo)}
                  </div>
                </div>
              </div>

              {extrato.movimentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum movimento no período.</p>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Origem</th>
                        <th className="px-3 py-2 text-left">Descrição</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extrato.movimentos.map((m, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground text-xs">{formatDateBR(m.data, m.data)}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{m.contaContabil ?? ORIGEM_LABEL[m.origem] ?? m.origem}</td>
                          <td className="px-3 py-2">{m.descricao}</td>
                          <td className={`px-3 py-2 text-right ${m.movimento === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                            {m.movimento === "entrada" ? "+" : "−"}{fmt(m.valor)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(m.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
