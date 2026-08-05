import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { LoteamentoMultiCombobox } from "@/components/ui/loteamento-multi-combobox";
import { formatDateBR } from "@/lib/date-br";
import { AlertTriangle, Clock, Wallet, Search } from "lucide-react";

interface Loteamento {
  id_loteamento: number;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
}

interface ParcelaAReceber {
  id_pagamento: number;
  id_cliente: number;
  cliente: string;
  id_loteamento: number;
  loteamento: string;
  id_lote: number;
  quadra: string;
  lote: string;
  id_venda: number;
  numeroParcela: number;
  totalParcelas: number;
  vencimento: string;
  valor: number;
  diasAtraso: number;
}

interface AReceberResponse {
  parcelas: ParcelaAReceber[];
  totalEmAberto: number;
  totalAtrasado: number;
  totalAVencer: number;
  qtdAtrasadas: number;
  qtdAVencer: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function AReceberPorLoteTab({ onVerCliente }: { onVerCliente?: (id: number, nome: string) => void }) {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [loteamentos, setLoteamentos] = useState<number[]>([]);
  const [buscaLote, setBuscaLote] = useState("");
  const [somenteAtrasadas, setSomenteAtrasadas] = useState(false);

  const { data: listaLoteamentos = [], isLoading: carregandoLoteamentos } = useQuery<Loteamento[]>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const r = await fetch("/api/loteamentos", { headers });
      if (!r.ok) throw new Error("Erro ao carregar loteamentos");
      return r.json();
    },
  });

  const { data, isLoading } = useQuery<AReceberResponse>({
    queryKey: ["pagamentos", "a-receber", loteamentos, somenteAtrasadas],
    queryFn: async () => {
      const params = new URLSearchParams();
      loteamentos.forEach((id) => params.append("id_loteamento", String(id)));
      if (somenteAtrasadas) params.set("situacao", "atrasado");
      const qs = params.toString();
      const r = await fetch(`/api/pagamentos/a-receber${qs ? `?${qs}` : ""}`, { headers });
      if (!r.ok) throw new Error("Erro ao carregar contas a receber");
      return r.json();
    },
  });

  // Filtro de lote/quadra/cliente é aplicado no cliente sobre o resultado.
  const termo = buscaLote.trim().toLowerCase();
  const parcelas = useMemo(() => {
    const todas = data?.parcelas ?? [];
    if (!termo) return todas;
    return todas.filter(
      (p) =>
        p.lote.toLowerCase().includes(termo) ||
        p.quadra.toLowerCase().includes(termo) ||
        `${p.quadra}-${p.lote}`.toLowerCase().includes(termo) ||
        p.cliente.toLowerCase().includes(termo),
    );
  }, [data, termo]);

  // Quando há busca por lote, os totais precisam refletir o que está na tela.
  const totais = useMemo(() => {
    if (!termo) {
      return {
        emAberto: data?.totalEmAberto ?? 0,
        atrasado: data?.totalAtrasado ?? 0,
        aVencer: data?.totalAVencer ?? 0,
        qtdAtrasadas: data?.qtdAtrasadas ?? 0,
      };
    }
    const atrasado = parcelas.filter((p) => p.diasAtraso > 0).reduce((a, p) => a + p.valor, 0);
    const aVencer = parcelas.filter((p) => p.diasAtraso === 0).reduce((a, p) => a + p.valor, 0);
    return {
      emAberto: atrasado + aVencer,
      atrasado,
      aVencer,
      qtdAtrasadas: parcelas.filter((p) => p.diasAtraso > 0).length,
    };
  }, [data, parcelas, termo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <LoteamentoMultiCombobox
          loteamentos={listaLoteamentos}
          value={loteamentos}
          onValueChange={setLoteamentos}
          isLoading={carregandoLoteamentos}
          className="min-w-[220px]"
        />
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por quadra, lote ou cliente..."
            value={buscaLote}
            onChange={(e) => setBuscaLote(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={somenteAtrasadas ? "default" : "outline"}
          size="sm"
          onClick={() => setSomenteAtrasadas((v) => !v)}
        >
          Somente atrasadas
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Total em aberto
          </div>
          <div className="text-lg font-bold mt-1">{fmt(totais.emAberto)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Em atraso
          </div>
          <div className="text-lg font-bold mt-1 text-red-500">{fmt(totais.atrasado)}</div>
          <div className="text-[11px] text-muted-foreground">{totais.qtdAtrasadas} parcelas</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-amber-500" /> A vencer
          </div>
          <div className="text-lg font-bold mt-1 text-amber-600">{fmt(totais.aVencer)}</div>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold">Loteamento</th>
              <th className="px-4 py-3 text-left font-semibold">Lote</th>
              <th className="px-4 py-3 text-left font-semibold">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold">Parcela</th>
              <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <LoadingState className="py-0" />
                </td>
              </tr>
            ) : parcelas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma parcela em aberto para esse filtro.
                </td>
              </tr>
            ) : (
              parcelas.map((p) => (
                <tr key={p.id_pagamento} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{p.loteamento}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Q. {p.quadra} · L. {p.lote}
                  </td>
                  <td className="px-4 py-3">
                    {onVerCliente ? (
                      <button
                        type="button"
                        className="text-primary hover:underline text-left"
                        onClick={() => onVerCliente(p.id_cliente, p.cliente)}
                      >
                        {p.cliente}
                      </button>
                    ) : (
                      p.cliente
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.numeroParcela}/{p.totalParcelas}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={p.diasAtraso > 0 ? "text-red-500 font-medium" : ""}>
                        {formatDateBR(p.vencimento, p.vencimento)}
                      </span>
                      {p.diasAtraso > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          {p.diasAtraso}d
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(p.valor)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
