import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale, Percent, Wallet } from "lucide-react";
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

const COR_POSITIVO = "#059669"; // emerald-600
const COR_NEGATIVO = "#ef4444"; // red-500
const COR_ENTRADA = "#059669";
const COR_SAIDA = "#ef4444";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function VisaoGeralTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

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
          <CardTitle className="text-sm font-semibold">Fluxo de caixa (últimos 12 meses)</CardTitle>
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
