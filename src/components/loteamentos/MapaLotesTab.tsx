import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadingState } from "@/components/ui/loading-state";
import { ChevronDown, Grid3X3, Map, CheckCircle2, ShoppingCart } from "lucide-react";

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

function localDe(d: { cidade: string | null; estado: string | null }) {
  return [d.cidade, d.estado].filter(Boolean).join("/");
}

export function MapaLotesTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [busca, setBusca] = useState("");
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

  const termo = busca.trim().toLowerCase();
  const opcoes = termo
    ? todos.filter((d) => d.nome.toLowerCase().includes(termo) || localDe(d).toLowerCase().includes(termo))
    : todos;

  const dados = selecionados.length === 0 ? opcoes : todos.filter((d) => selecionados.includes(d.id_loteamento));

  function toggle(id: number) {
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

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
      const lista = mapa.get(l.quadra) ?? [];
      lista.push(l);
      mapa.set(l.quadra, lista);
    });
    return Array.from(mapa.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "pt-BR", { numeric: true })
    );
  }, [lotes]);

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
              <Button variant="ghost" size="sm" className="w-full mt-2 h-8 text-xs" onClick={() => setSelecionados([])}>
                Limpar seleção
              </Button>
            )}
          </PopoverContent>
        </Popover>
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
                      <Map className="h-3.5 w-3.5" />
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
                <Map className="h-4 w-4 text-primary" />
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
