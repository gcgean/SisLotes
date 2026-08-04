import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, AlertTriangle, CheckCircle2, Clock, Wallet } from "lucide-react";

interface DividaLoteamento {
  id_loteamento: number;
  nome: string;
  cidade: string | null;
  estado: string | null;
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
  const [busca, setBusca] = useState("");

  // Busca o dataset completo uma vez e filtra no cliente: a lista tem no máximo
  // uma linha por loteamento, então o filtro é instantâneo e as opções do
  // seletor saem sempre da mesma fonte que alimenta a tabela.
  const { data: todos = [], isLoading } = useQuery<DividaLoteamento[]>({
    queryKey: ["divida-por-loteamento"],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/divida-por-loteamento", { headers });
      if (!r.ok) throw new Error("Erro ao carregar dívida por loteamento");
      return r.json();
    },
  });

  const localDe = (d: { cidade: string | null; estado: string | null }) =>
    [d.cidade, d.estado].filter(Boolean).join("/");

  // Busca casa com o nome do loteamento ou com a cidade/estado vinculados a ele.
  const termo = busca.trim().toLowerCase();
  const opcoes = termo
    ? todos.filter(
        (d) => d.nome.toLowerCase().includes(termo) || localDe(d).toLowerCase().includes(termo)
      )
    : todos;

  const dados = selecionados.length === 0 ? opcoes : todos.filter((d) => selecionados.includes(d.id_loteamento));

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
        ? todos.find((l) => l.id_loteamento === selecionados[0])?.nome ?? "1 loteamento"
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
          <PopoverContent className="w-[300px] p-2" align="start">
            <Input
              placeholder="Buscar por loteamento ou cidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 mb-2 text-sm"
            />
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {opcoes.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  {isLoading ? "Carregando…" : "Nenhum loteamento encontrado."}
                </div>
              )}
              {/* Botão (não <label>) para o clique disparar o toggle uma única vez:
                  um <label> em volta do Checkbox faz o evento chegar duas vezes. */}
              {opcoes.map((l) => {
                const local = localDe(l);
                return (
                  <button
                    key={l.id_loteamento}
                    type="button"
                    onClick={() => toggle(l.id_loteamento)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm text-left"
                  >
                    <Checkbox
                      checked={selecionados.includes(l.id_loteamento)}
                      className="pointer-events-none shrink-0"
                      tabIndex={-1}
                    />
                    <span className="truncate flex-1 min-w-0">
                      {l.nome}
                      {local && <span className="text-xs text-muted-foreground"> — {local}</span>}
                    </span>
                  </button>
                );
              })}
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
                        {localDe(d) && `${localDe(d)} · `}
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
