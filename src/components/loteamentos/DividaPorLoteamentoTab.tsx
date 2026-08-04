import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, AlertTriangle, CheckCircle2, Clock, Wallet } from "lucide-react";

interface Loteamento {
  id_loteamento: number;
  nome: string;
}

interface DividaLoteamento {
  id_loteamento: number;
  nome: string;
  totalVendido: number;
  totalPago: number;
  totalAtrasado: number;
  totalAVencer: number;
  qtdParcelasAtrasadas: number;
  qtdParcelasAVencer: number;
  qtdVendas: number;
  percentualPago: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function DividaPorLoteamentoTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [selecionados, setSelecionados] = useState<number[]>([]);

  const { data: loteamentos = [] } = useQuery<Loteamento[]>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const r = await fetch("/api/loteamentos", { headers });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: dados = [], isLoading } = useQuery<DividaLoteamento[]>({
    queryKey: ["divida-por-loteamento", selecionados],
    queryFn: async () => {
      const params = new URLSearchParams();
      selecionados.forEach((id) => params.append("id_loteamento", String(id)));
      const qs = params.toString();
      const r = await fetch(`/api/relatorios/divida-por-loteamento${qs ? `?${qs}` : ""}`, { headers });
      if (!r.ok) throw new Error("Erro ao carregar dívida por loteamento");
      return r.json();
    },
  });

  function toggle(id: number) {
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  const totais = dados.reduce(
    (acc, d) => ({
      vendido: acc.vendido + d.totalVendido,
      pago: acc.pago + d.totalPago,
      atrasado: acc.atrasado + d.totalAtrasado,
      aVencer: acc.aVencer + d.totalAVencer,
    }),
    { vendido: 0, pago: 0, atrasado: 0, aVencer: 0 }
  );

  const rotuloFiltro =
    selecionados.length === 0
      ? "Todos os loteamentos"
      : selecionados.length === 1
        ? loteamentos.find((l) => l.id_loteamento === selecionados[0])?.nome ?? "1 loteamento"
        : `${selecionados.length} loteamentos`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[220px] justify-between">
              <span className="truncate">{rotuloFiltro}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-2" align="start">
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {loteamentos.map((l) => (
                <label
                  key={l.id_loteamento}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selecionados.includes(l.id_loteamento)}
                    onCheckedChange={() => toggle(l.id_loteamento)}
                  />
                  <span className="truncate">{l.nome}</span>
                </label>
              ))}
            </div>
            {selecionados.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 h-8 text-xs"
                onClick={() => setSelecionados([])}
              >
                Limpar seleção
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Total vendido
          </div>
          <div className="text-lg font-bold mt-1">{fmt(totais.vendido)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Já pago
          </div>
          <div className="text-lg font-bold mt-1 text-emerald-600">{fmt(totais.pago)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Em atraso
          </div>
          <div className="text-lg font-bold mt-1 text-red-500">{fmt(totais.atrasado)}</div>
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
              <th className="px-4 py-3 text-right font-semibold">Vendido</th>
              <th className="px-4 py-3 text-right font-semibold">Pago</th>
              <th className="px-4 py-3 text-right font-semibold">Em atraso</th>
              <th className="px-4 py-3 text-right font-semibold">A vencer</th>
              <th className="px-4 py-3 text-right font-semibold">Falta receber</th>
              <th className="px-4 py-3 text-left font-semibold w-[140px]">% recebido</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : dados.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum loteamento encontrado.</td></tr>
            ) : (
              dados.map((d) => {
                const faltaReceber = d.totalAtrasado + d.totalAVencer;
                return (
                  <tr key={d.id_loteamento} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.qtdVendas} {d.qtdVendas === 1 ? "venda" : "vendas"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(d.totalVendido)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(d.totalPago)}</td>
                    <td className="px-4 py-3 text-right">
                      {d.totalAtrasado > 0 ? (
                        <div>
                          <div className="text-red-500 font-medium">{fmt(d.totalAtrasado)}</div>
                          <Badge variant="destructive" className="text-[10px] mt-0.5">
                            {d.qtdParcelasAtrasadas} {d.qtdParcelasAtrasadas === 1 ? "parcela" : "parcelas"}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.totalAVencer > 0 ? (
                        <div>
                          <div className="text-amber-600 font-medium">{fmt(d.totalAVencer)}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {d.qtdParcelasAVencer} {d.qtdParcelasAVencer === 1 ? "parcela" : "parcelas"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(faltaReceber)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, d.percentualPago)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {d.percentualPago.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {dados.length > 0 && (
            <tfoot>
              <tr className="bg-muted/20 font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">{fmt(totais.vendido)}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{fmt(totais.pago)}</td>
                <td className="px-4 py-3 text-right text-red-500">{fmt(totais.atrasado)}</td>
                <td className="px-4 py-3 text-right text-amber-600">{fmt(totais.aVencer)}</td>
                <td className="px-4 py-3 text-right">{fmt(totais.atrasado + totais.aVencer)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
