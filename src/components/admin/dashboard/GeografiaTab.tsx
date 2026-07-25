import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GeografiaResponse {
  porEstado: { estado: string; total: number }[];
  porCidade: { cidade: string; estado: string; total: number }[];
}

const CHART_COLOR = "#059669"; // emerald-600 — mesma cor usada nos cards/ícones da área administrativa

export function GeografiaTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const { data, isLoading } = useQuery<GeografiaResponse>({
    queryKey: ["admin-dashboard", "geografia"],
    queryFn: async () => {
      const r = await fetch("/api/admin/dashboard/geografia", { headers });
      if (!r.ok) throw new Error("Erro ao buscar geografia");
      return r.json();
    },
  });

  if (isLoading || !data) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  const chartHeight = Math.max(240, data.porEstado.length * 28);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            Cadastros por estado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.porEstado.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de estado ainda.</p>
          ) : (
            <div
              style={{ height: chartHeight }}
              className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.porEstado} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="estado" width={40} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => [`${value} empresa(s)`, "Total"]}
                  />
                  <Bar dataKey="total" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Top cidades</CardTitle>
        </CardHeader>
        <CardContent>
          {data.porCidade.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de cidade ainda.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-semibold">Cidade</th>
                    <th className="px-4 py-2 text-left font-semibold">UF</th>
                    <th className="px-4 py-2 text-left font-semibold">Empresas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porCidade.map((c, i) => (
                    <tr key={`${c.cidade}-${c.estado}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2">{c.cidade}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.estado}</td>
                      <td className="px-4 py-2 font-medium">{c.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
