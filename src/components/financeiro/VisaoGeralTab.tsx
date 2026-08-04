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
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  const { data: resultadoLoteamento = [] } = useQuery<ResultadoLoteamento[]>({
    queryKey: ["financeiro", "resultado-por-loteamento"],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/resultado-por-loteamento", { headers });
      if (!r.ok) throw new Error("Erro ao carregar resultado por loteamento");
      return r.json();
    },
  });

  const { data: fluxoCaixa = [] } = useQuery<FluxoCaixaMes[]>({
    queryKey: ["financeiro", "fluxo-de-caixa"],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/fluxo-de-caixa", { headers });
      if (!r.ok) throw new Error("Erro ao carregar fluxo de caixa");
      return r.json();
    },
  });

  const { data: contas = [] } = useQuery<Conta[]>({
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
            <span className="text-sm font-medium min-w-[140px] text-center capitalize">{mesLabel(mesSelecionado)}</span>
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
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Saldo inicial do período</div>
                  <div className={`text-base font-bold ${fluxoFuturo.saldoInicialPeriodo >= 0 ? "" : "text-red-500"}`}>
                    {fmt(fluxoFuturo.saldoInicialPeriodo)}
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground">A pagar no mês</div>
                  <div className="text-base font-bold text-red-500">{fmt(fluxoFuturo.totalAPagar)}</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground">A receber no mês</div>
                  <div className="text-base font-bold text-emerald-600">{fmt(fluxoFuturo.totalAReceber)}</div>
                </div>
                <div className="rounded-lg border p-3 text-center bg-muted/30">
                  <div className="text-xs text-muted-foreground">Saldo final projetado</div>
                  <div className={`text-base font-bold ${fluxoFuturo.saldoFinalProjetado >= 0 ? "" : "text-red-500"}`}>
                    {fmt(fluxoFuturo.saldoFinalProjetado)}
                  </div>
                </div>
              </div>

              {/* Alerta / recomendação */}
              {fluxoFuturo.diasNegativos.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold text-red-600">Risco de falta de caixa: </span>
                    previsão de saldo negativo em {fluxoFuturo.diasNegativos.length}{" "}
                    {fluxoFuturo.diasNegativos.length === 1 ? "dia" : "dias"} do mês (
                    {fluxoFuturo.diasNegativos.map((d) => diaLabel(d).numero).join(", ")}). Considere antecipar
                    recebíveis, negociar prazos com fornecedores ou adiar pagamentos não essenciais para depois de{" "}
                    {fluxoFuturo.melhorDiaPagamento ? diaLabel(fluxoFuturo.melhorDiaPagamento).numero : "—"}.
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-3 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Fluxo de caixa positivo </span>
                    em todo o mês.
                    {fluxoFuturo.melhorDiaPagamento && (
                      <>
                        {" "}Melhor dia para concentrar pagamentos extras ou compras:{" "}
                        <span className="font-semibold">dia {diaLabel(fluxoFuturo.melhorDiaPagamento).numero}</span>{" "}
                        (saldo projetado de {fmt(fluxoFuturo.melhorDiaSaldo ?? 0)}).
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Dia a dia do mês — dashboard horizontal com scroll lateral */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">Dia a dia do mês (arraste para o lado)</div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {fluxoFuturo.dias.map((d) => {
                    const { numero, semana } = diaLabel(d.data);
                    const semMovimento = d.aPagar === 0 && d.aReceber === 0;
                    return (
                      <div
                        key={d.data}
                        className={`shrink-0 w-[132px] rounded-lg border p-2.5 flex flex-col gap-1.5 ${
                          d.saldoDia < 0 ? "border-red-300 bg-red-50 dark:bg-red-950/10 dark:border-red-900" : ""
                        }`}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-bold">{numero}</span>
                          <span className="text-[11px] text-muted-foreground uppercase">{semana}</span>
                        </div>

                        <div className="space-y-0.5 min-h-[36px]">
                          {d.aPagar > 0 ? (
                            <div
                              className="flex items-center gap-1 text-red-500 font-medium text-xs"
                              title={d.itensPagar.map((i) => `${i.descricao} (${i.terceiro ?? "—"})`).join("; ")}
                            >
                              <ArrowDownCircle className="h-3 w-3 shrink-0" /> {fmt(d.aPagar)}
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground/60">Sem pagamentos</div>
                          )}
                          {d.aReceber > 0 ? (
                            <div
                              className="flex items-center gap-1 text-emerald-600 font-medium text-xs"
                              title={d.itensReceber.map((i) => `${i.descricao} (${i.terceiro ?? "—"})`).join("; ")}
                            >
                              <ArrowUpCircle className="h-3 w-3 shrink-0" /> {fmt(d.aReceber)}
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground/60">Sem recebimentos</div>
                          )}
                        </div>

                        <div className="pt-1.5 mt-auto border-t">
                          <div className="text-[10px] text-muted-foreground">Saldo do dia</div>
                          <div
                            className={`text-sm font-semibold ${
                              semMovimento ? "text-muted-foreground" : d.saldoDia >= 0 ? "" : "text-red-500"
                            }`}
                          >
                            {fmt(d.saldoDia)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
          {contas.length === 0 ? (
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
          {resultadoLoteamento.length === 0 ? (
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
          {fluxoCaixa.length === 0 ? (
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
    </div>
  );
}
