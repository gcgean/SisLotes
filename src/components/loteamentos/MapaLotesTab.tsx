import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadingState } from "@/components/ui/loading-state";
import {
  LoteamentoMultiCombobox,
  localDoLoteamento,
} from "@/components/ui/loteamento-multi-combobox";
// O ícone é importado com alias: "Map" sobrescreveria o construtor nativo
// usado em `new Map()` mais abaixo e quebraria a tela em runtime.
import { Grid3X3, Map as MapIcon, CheckCircle2, ShoppingCart } from "lucide-react";

interface LotesLoteamento {
  id_loteamento: number;
  nome: string;
  cidade: string | null;
  estado: string | null;
  totalLotes: number;
  vendidos: number;
  disponiveis: number;
  percentualVendido: number;
}

interface LoteDoLoteamento {
  id_lote: number;
  lote: string;
  quadra: string;
  area?: string | null;
  status: "disponivel" | "vendido";
  cliente: string | null;
  status_venda: string | null;
}

const localDe = localDoLoteamento;

export function MapaLotesTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [mapaDe, setMapaDe] = useState<LotesLoteamento | null>(null);

  const { data: todos = [], isLoading } = useQuery<LotesLoteamento[]>({
    queryKey: ["lotes-por-loteamento"],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/lotes-por-loteamento", { headers });
      if (!r.ok) throw new Error("Erro ao carregar lotes por loteamento");
      return r.json();
    },
  });

  // Lotes do loteamento aberto no mapa (endpoint já existente).
  const { data: lotes = [], isLoading: carregandoLotes } = useQuery<LoteDoLoteamento[]>({
    queryKey: ["loteamento-lotes", mapaDe?.id_loteamento],
    enabled: mapaDe !== null,
    queryFn: async () => {
      const r = await fetch(`/api/loteamentos/${mapaDe!.id_loteamento}/lotes`, { headers });
      if (!r.ok) throw new Error("Erro ao carregar lotes");
      return r.json();
    },
  });

  const dados = selecionados.length === 0 ? todos : todos.filter((d) => selecionados.includes(d.id_loteamento));

  const totais = dados.reduce(
    (acc, d) => ({
      total: acc.total + d.totalLotes,
      vendidos: acc.vendidos + d.vendidos,
      disponiveis: acc.disponiveis + d.disponiveis,
    }),
    { total: 0, vendidos: 0, disponiveis: 0 }
  );

  // Agrupa os lotes por quadra para desenhar o "mapa" do loteamento.
  const quadras = useMemo(() => {
    const mapa = new Map<string, LoteDoLoteamento[]>();
    lotes.forEach((l) => {
      // Base legada pode ter quadra vazia/nula — agrupa sob "—" em vez de quebrar.
      const chave = l.quadra != null && String(l.quadra).trim() !== "" ? String(l.quadra) : "—";
      const lista = mapa.get(chave) ?? [];
      lista.push(l);
      mapa.set(chave, lista);
    });
    return Array.from(mapa.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "pt-BR", { numeric: true })
    );
  }, [lotes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <LoteamentoMultiCombobox
          loteamentos={todos}
          value={selecionados}
          onValueChange={setSelecionados}
          isLoading={isLoading}
          className="min-w-[220px]"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Grid3X3 className="h-3.5 w-3.5" /> Total de lotes
          </div>
          <div className="text-lg font-bold mt-1">{totais.total}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Disponíveis
          </div>
          <div className="text-lg font-bold mt-1 text-emerald-600">{totais.disponiveis}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShoppingCart className="h-3.5 w-3.5 text-orange-500" /> Vendidos
          </div>
          <div className="text-lg font-bold mt-1 text-orange-500">{totais.vendidos}</div>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold">Loteamento</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-right font-semibold">Disponíveis</th>
              <th className="px-4 py-3 text-right font-semibold">Vendidos</th>
              <th className="px-4 py-3 text-left font-semibold w-[140px]">% vendido</th>
              <th className="px-4 py-3 text-right font-semibold">Mapa</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <LoadingState className="py-0" />
                </td>
              </tr>
            ) : dados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum loteamento encontrado.
                </td>
              </tr>
            ) : (
              dados.map((d) => (
                <tr key={d.id_loteamento} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.nome}</div>
                    {localDe(d) && <div className="text-xs text-muted-foreground">{localDe(d)}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">{d.totalLotes}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{d.disponiveis}</td>
                  <td className="px-4 py-3 text-right text-orange-500 font-medium">{d.vendidos}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, d.percentualVendido)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {d.percentualVendido.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant={mapaDe?.id_loteamento === d.id_loteamento ? "default" : "outline"}
                      className="gap-1.5"
                      disabled={d.totalLotes === 0}
                      onClick={() => setMapaDe(mapaDe?.id_loteamento === d.id_loteamento ? null : d)}
                    >
                      <MapIcon className="h-3.5 w-3.5" />
                      {mapaDe?.id_loteamento === d.id_loteamento ? "Fechar" : "Ver mapa"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mapa visual: lotes agrupados por quadra */}
      {mapaDe && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-primary" />
                Mapa de lotes — {mapaDe.nome}
              </h3>
              {localDe(mapaDe) && <p className="text-xs text-muted-foreground mt-0.5">{localDe(mapaDe)}</p>}
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-500 inline-block" /> Disponível
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-orange-500 inline-block" /> Vendido
              </span>
            </div>
          </div>

          {carregandoLotes ? (
            <LoadingState message="Carregando mapa de lotes…" />
          ) : quadras.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum lote cadastrado neste loteamento.
            </p>
          ) : (
            <TooltipProvider delayDuration={100}>
              <div className="space-y-4 max-h-[520px] overflow-y-auto">
                {quadras.map(([quadra, lotesDaQuadra]) => (
                  <div key={quadra}>
                    <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                      Quadra {quadra}
                      <span className="font-normal"> · {lotesDaQuadra.length} lotes</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lotesDaQuadra.map((l) => (
                        <Tooltip key={l.id_lote}>
                          <TooltipTrigger asChild>
                            <div
                              className={`h-10 w-10 rounded flex items-center justify-center text-[11px] font-semibold text-white cursor-default transition-transform hover:scale-110 ${
                                l.status === "vendido" ? "bg-orange-500" : "bg-emerald-500"
                              }`}
                            >
                              {l.lote}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <div className="font-semibold">
                                Quadra {l.quadra} · Lote {l.lote}
                              </div>
                              <div>{l.status === "vendido" ? "Vendido" : "Disponível"}</div>
                              {l.cliente && <div>Cliente: {l.cliente}</div>}
                              {l.area && <div>Área: {l.area}</div>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
}
