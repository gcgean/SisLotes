import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Percent,
  Wallet,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LoadingState } from "@/components/ui/loading-state";

interface DashboardKpis {
  recebidoMes: number;
  despesasMes: number;
}

interface ResultadoLoteamento {
  id_loteamento: number;
  loteamento: string;
  receita: number;
  despesas: number;
  resultado: number;
}

interface FluxoCaixaMes {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

interface Conta {
  id_conta: number;
  apelido: string;
  tipo: "banco" | "caixa";
  ativo: boolean;
  saldo_atual?: number;
}

interface ItemDia {
  descricao: string;
  valor: number;
  terceiro: string | null;
}

interface DiaFluxo {
  data: string;
  aPagar: number;
  aReceber: number;
  resultadoDia: number;
  saldoDia: number;
  itensPagar: ItemDia[];
  itensReceber: ItemDia[];
}

interface FluxoCaixaFuturo {
  mes: string;
  saldoInicialPeriodo: number;
  totalAPagar: number;
  totalAReceber: number;
  saldoFinalProjetado: number;
  dias: DiaFluxo[];
  diasNegativos: string[];
  melhorDiaPagamento: string | null;
  melhorDiaSaldo: number | null;
}

const COR_POSITIVO = "#059669"; // emerald-600
const COR_NEGATIVO = "#ef4444"; // red-500
const COR_ENTRADA = "#059669";
const COR_SAIDA = "#ef4444";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function mesAtualIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function hojeIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function somarMeses(mesIso: string, delta: number) {
  const [ano, mes] = mesIso.split("-").map(Number);
  const d = new Date(ano, mes - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesLabel(mesIso: string) {
  const [ano, mes] = mesIso.split("-").map(Number);
  const d = new Date(ano, mes - 1, 1);
  const label = format(d, "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function diaLabel(iso: string) {
  const d = parseISO(iso);
  return { numero: format(d, "dd"), semana: format(d, "EEEEEE", { locale: ptBR }) };
}

export function VisaoGeralTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [mesSelecionado, setMesSelecionado] = useState(mesAtualIso());

  const { data: fluxoFuturo, isLoading: carregandoFluxoFuturo } = useQuery<FluxoCaixaFuturo>({
    queryKey: ["financeiro", "fluxo-de-caixa-futuro", mesSelecionado],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/fluxo-de-caixa-futuro?mes=${mesSelecionado}`, { headers });
      if (!r.ok) throw new Error("Erro ao carregar fluxo de caixa futuro");
      return r.json();
    },
  });

  const { data: kpis } = useQuery<DashboardKpis>({
    queryKey: ["financeiro", "dashboard-kpis"],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/dashboard-kpis", { headers });
      if (!r.ok) throw new Error("Erro ao carregar KPIs");
      return r.json();
    },
  });

  const { data: resultadoLoteamento = [], isLoading: carregandoResultado } = useQuery<ResultadoLoteamento[]>({
    queryKey: ["financeiro", "resultado-por-loteamento"],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/resultado-por-loteamento", { headers });
      if (!r.ok) throw new Error("Erro ao carregar resultado por loteamento");
      return r.json();
    },
  });

  const { data: fluxoCaixa = [], isLoading: carregandoFluxo } = useQuery<FluxoCaixaMes[]>({
    queryKey: ["financeiro", "fluxo-de-caixa"],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/fluxo-de-caixa", { headers });
      if (!r.ok) throw new Error("Erro ao carregar fluxo de caixa");
      return r.json();
    },
  });

  const { data: fluxoPrevisto = [], isLoading: carregandoPrevisto } = useQuery<FluxoCaixaMes[]>({
    queryKey: ["financeiro", "fluxo-de-caixa-previsto"],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/fluxo-de-caixa-previsto", { headers });
      if (!r.ok) throw new Error("Erro ao carregar previsão de fluxo de caixa");
      return r.json();
    },
  });

  const { data: contas = [], isLoading: carregandoContas } = useQuery<Conta[]>({
    queryKey: ["financeiro", "contas"],
    queryFn: async () => {
      const r = await fetch("/api/contas?ativo=true", { headers });
      if (!r.ok) throw new Error("Erro ao carregar contas");
      return r.json();
    },
  });

  const receita = kpis?.recebidoMes ?? 0;
  const despesa = kpis?.despesasMes ?? 0;
  const resultado = receita - despesa;
  const margem = receita > 0 ? (resultado / receita) * 100 : 0;

  // A partir de hoje até o fim do mês selecionado (se o mês já passou, mostra o mês inteiro).
  const hojeLocal = hojeIsoLocal();
  const diasFuturos = fluxoFuturo
    ? fluxoFuturo.dias.filter((d) => mesSelecionado !== mesAtualIso() || d.data >= hojeLocal)
    : [];
  // Ambos os valores entram positivos: barras lado a lado sobem a partir da base,
  // que é bem mais legível do que "a pagar" negativo puxando o eixo para baixo.
  const graficoDias = diasFuturos.map((d) => ({
    data: d.data,
    label: diaLabel(d.data).numero,
    aReceber: d.aReceber,
    aPagar: d.aPagar,
    saldo: d.saldoDia,
  }));

  // Melhor dia só faz sentido entre os dias que ainda vão acontecer.
  const melhorDiaFuturo = diasFuturos.reduce<DiaFluxo | null>(
    (melhor, d) => (melhor === null || d.saldoDia > melhor.saldoDia ? d : melhor),
    null,
  );
  const diasNegativosFuturos = diasFuturos.filter((d) => d.saldoDia < 0);
  const totalMovimentoNoGrafico = diasFuturos.reduce((a, d) => a + d.aPagar + d.aReceber, 0);

  const loteamentoChartHeight = Math.max(200, resultadoLoteamento.length * 32);

  return (
    <div className="space-y-6">
      {/* Fluxo de caixa futuro do mês */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-emerald-600" />
            Fluxo de caixa futuro do mês
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMesSelecionado((m) => somarMeses(m, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* Sem "capitalize": mesLabel já devolve "Agosto de 2026" — a classe
                deixaria "Agosto De 2026". */}
            <span className="text-sm font-medium min-w-[150px] text-center">{mesLabel(mesSelecionado)}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMesSelecionado((m) => somarMeses(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {carregandoFluxoFuturo || !fluxoFuturo ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando projeção…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5 shrink-0" /> Saldo inicial
                  </div>
                  <div className={`text-xl font-bold mt-1 ${fluxoFuturo.saldoInicialPeriodo >= 0 ? "" : "text-red-500"}`}>
                    {fmt(fluxoFuturo.saldoInicialPeriodo)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">no início do período</div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowDownCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /> A pagar
                  </div>
                  <div className="text-xl font-bold mt-1 text-red-500">{fmt(fluxoFuturo.totalAPagar)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">sai do caixa no mês</div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> A receber
                  </div>
                  <div className="text-xl font-bold mt-1 text-emerald-600">{fmt(fluxoFuturo.totalAReceber)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">entra no caixa no mês</div>
                </div>

                {/* Destaque: é a resposta da pergunta "vai sobrar ou faltar dinheiro?" */}
                <div
                  className={`rounded-lg border-2 p-3 ${
                    fluxoFuturo.saldoFinalProjetado >= 0
                      ? "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20"
                      : "border-red-500/50 bg-red-50/60 dark:bg-red-950/20"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" /> Saldo final projetado
                  </div>
                  <div className={`text-xl font-bold mt-1 ${fluxoFuturo.saldoFinalProjetado >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {fmt(fluxoFuturo.saldoFinalProjetado)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {(() => {
                      const variacao = fluxoFuturo.saldoFinalProjetado - fluxoFuturo.saldoInicialPeriodo;
                      if (variacao === 0) return "sem variação no período";
                      return `${variacao > 0 ? "+" : "−"}${fmt(Math.abs(variacao))} no período`;
                    })()}
                  </div>
                </div>
              </div>

              {/* Alerta / recomendação — considera apenas os dias que ainda vão acontecer */}
              {diasNegativosFuturos.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold text-red-600">Risco de falta de caixa: </span>
                    previsão de saldo negativo em {diasNegativosFuturos.length}{" "}
                    {diasNegativosFuturos.length === 1 ? "dia" : "dias"} (
                    {diasNegativosFuturos.map((d) => diaLabel(d.data).numero).join(", ")}). Considere antecipar
                    recebíveis, negociar prazos com fornecedores ou adiar pagamentos não essenciais para depois do dia{" "}
                    {melhorDiaFuturo ? diaLabel(melhorDiaFuturo.data).numero : "—"}.
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-3 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Fluxo de caixa positivo </span>
                    em todos os dias restantes do mês.
                    {melhorDiaFuturo && (
                      <>
                        {" "}Melhor dia para concentrar pagamentos extras ou compras:{" "}
                        <span className="font-semibold">dia {diaLabel(melhorDiaFuturo.data).numero}</span>{" "}
                        (saldo projetado de {fmt(melhorDiaFuturo.saldoDia)}).
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Volume de receitas/despesas e evolução do saldo, a partir de hoje até o fim do mês */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">
                  Receitas, despesas e evolução do saldo — de hoje até o fim do mês
                </div>
                {graficoDias.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhum dia restante nesse período para projetar.
                  </p>
                ) : (
                  <div
                    style={{ height: 320 }}
                    className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={graficoDias} margin={{ left: 8, right: 8, top: 8 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                        {/* Movimentos do dia (barras) à esquerda; saldo acumulado (linha) à direita.
                            Escalas separadas porque o saldo costuma ser ordens de grandeza maior. */}
                        <YAxis
                          yAxisId="mov"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => fmt(v)}
                          width={88}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          yAxisId="saldo"
                          orientation="right"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => fmt(v)}
                          width={88}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                          formatter={(value: number, name: string) => {
                            if (name === "saldo") return [fmt(value), "Saldo projetado"];
                            if (name === "aPagar") return [fmt(value), "A pagar"];
                            return [fmt(value), "A receber"];
                          }}
                          labelFormatter={(label) => `Dia ${label}`}
                        />
                        <Legend
                          formatter={(value) =>
                            value === "saldo" ? "Saldo projetado" : value === "aPagar" ? "A pagar" : "A receber"
                          }
                          wrapperStyle={{ fontSize: 12 }}
                        />
                        {/* Linha do zero: deixa explícito quando o saldo entra no negativo. */}
                        <ReferenceLine yAxisId="saldo" y={0} stroke={COR_NEGATIVO} strokeDasharray="4 4" />
                        <Bar yAxisId="mov" dataKey="aReceber" fill={COR_ENTRADA} radius={[3, 3, 0, 0]} maxBarSize={22} />
                        <Bar yAxisId="mov" dataKey="aPagar" fill={COR_SAIDA} radius={[3, 3, 0, 0]} maxBarSize={22} />
                        <Line
                          yAxisId="saldo"
                          type="monotone"
                          dataKey="saldo"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          dot={{ r: 2.5 }}
                          activeDot={{ r: 5 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {totalMovimentoNoGrafico === 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Nenhuma conta a pagar ou receber lançada para os dias restantes — a linha mostra o saldo
                    atual se mantendo.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Receita (mês)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-lg font-bold">{fmt(receita)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Despesa (mês)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-lg font-bold">{fmt(despesa)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Resultado (mês)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <Scale className={`h-4 w-4 ${resultado >= 0 ? "text-emerald-600" : "text-red-500"}`} />
              <span className={`text-lg font-bold ${resultado >= 0 ? "" : "text-red-500"}`}>{fmt(resultado)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Margem (mês)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <Percent className={`h-4 w-4 ${margem >= 0 ? "text-emerald-600" : "text-red-500"}`} />
              <span className="text-lg font-bold">{margem.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saldo por conta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600" />
            Saldo por conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoContas ? (<LoadingState message="Carregando contas…" />) : contas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhuma conta cadastrada ainda.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {contas.map((c) => (
                <div key={c.id_conta} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.apelido}</span>
                    <span className="text-xs text-muted-foreground uppercase">{c.tipo}</span>
                  </div>
                  <div className={`text-xl font-bold mt-1 ${(c.saldo_atual ?? 0) >= 0 ? "" : "text-red-500"}`}>
                    {fmt(c.saldo_atual ?? 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lucratividade por loteamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Lucratividade por loteamento</CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoResultado ? (<LoadingState message="Carregando lucratividade…" />) : resultadoLoteamento.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum loteamento com dados ainda.</p>
          ) : (
            <div
              style={{ height: loteamentoChartHeight }}
              className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resultadoLoteamento} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
                  <YAxis type="category" dataKey="loteamento" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => [fmt(value), "Resultado"]}
                  />
                  <Bar dataKey="resultado" radius={[0, 4, 4, 0]}>
                    {resultadoLoteamento.map((row) => (
                      <Cell key={row.id_loteamento} fill={row.resultado >= 0 ? COR_POSITIVO : COR_NEGATIVO} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fluxo de caixa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Evolução do fluxo de caixa — entradas e saídas (últimos 12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoFluxo ? (<LoadingState message="Carregando fluxo de caixa…" />) : fluxoCaixa.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Sem movimentação registrada ainda.</p>
          ) : (
            <div
              style={{ height: 280 }}
              className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fluxoCaixa} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} width={90} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string) => [fmt(value), name === "entradas" ? "Entradas" : "Saídas"]}
                  />
                  <Legend
                    formatter={(value) => (value === "entradas" ? "Entradas" : "Saídas")}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="entradas" fill={COR_ENTRADA} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" fill={COR_SAIDA} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Previsão do fluxo de caixa — próximos 12 meses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-emerald-600" />
            Previsão do fluxo de caixa — próximos 12 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoPrevisto ? (<LoadingState message="Carregando previsão…" />) : fluxoPrevisto.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhuma parcela em aberto para projetar.</p>
          ) : (
            <div
              style={{ height: 300 }}
              className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fluxoPrevisto} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="mov" tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} width={90} />
                  <YAxis yAxisId="saldo" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} width={90} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string) => {
                      if (name === "saldo") return [fmt(value), "Saldo do caixa"];
                      return [fmt(value), name === "entradas" ? "Entradas previstas" : "Saídas previstas"];
                    }}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "saldo" ? "Saldo do caixa" : value === "entradas" ? "Entradas previstas" : "Saídas previstas"
                    }
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Bar yAxisId="mov" dataKey="entradas" fill={COR_ENTRADA} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="mov" dataKey="saidas" fill={COR_SAIDA} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="saldo" type="monotone" dataKey="saldo" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Baseado nas parcelas de venda e contas a pagar já cadastradas com vencimento em cada mês, partindo do saldo
            atual das contas. Meses sem lançamentos futuros cadastrados aparecem com entradas/saídas zeradas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
