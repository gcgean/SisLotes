import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, MousePointerClick, Eye, Timer, TrendingUp } from "lucide-react";

interface Analytics {
  resumo: {
    visitas: number;
    visitantes: number;
    sessoes: number;
    ctaClicks: number;
    sessoesComCta: number;
    ctr: number;
    tempoMedioSeg: number;
    scrollMedioPct: number;
  };
  funnel: Record<string, number>;
  ctas: { cta: string; cliques: number; sessoes: number }[];
  fontes: { fonte: string; sessoes: number }[];
  serie: { dia: string; visitas: number; conversoes: number }[];
  recentes: { visitorId: string | null; device: string | null; fonte: string | null; referrer: string | null; ip: string | null; quando: string | null }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  token: string | null;
}

const SECOES: { key: string; label: string }[] = [
  { key: "hero", label: "Topo (Hero)" },
  { key: "prova", label: "Prova social" },
  { key: "dor", label: "Dor / Problema" },
  { key: "funcionalidades", label: "Funcionalidades" },
  { key: "planos", label: "Preços" },
  { key: "garantias", label: "Garantias" },
  { key: "faq", label: "FAQ" },
  { key: "final", label: "CTA Final" },
];

const CTA_LABELS: Record<string, string> = {
  "precos-trial": "Preços — Testar grátis",
  "final-trial": "CTA final — Testar grátis",
  "final-consultor": "CTA final — Falar com consultor",
  "mobile-sticky": "Botão fixo mobile",
  "plano-starter": "Plano Starter",
  "plano-pro": "Plano Pro",
  "plano-business": "Plano Business",
  "plano-premium": "Plano Premium",
  "plano-enterprise": "Plano Enterprise",
};

function fmtTempo(seg: number): string {
  if (!seg) return "0s";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function LpAnalyticsDialog({ open, onClose, token }: Props) {
  const headers = { Authorization: `Bearer ${token}` };
  const [dias, setDias] = useState(30);

  const from = useMemo(() => {
    const d = new Date(Date.now() - dias * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }, [dias]);

  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["lp-analytics", from],
    enabled: open,
    queryFn: async () => {
      const r = await fetch(`/api/admin/lp/analytics?from=${from}`, { headers });
      if (!r.ok) throw new Error("Erro ao carregar analytics");
      return r.json();
    },
  });

  const sessoes = data?.resumo.sessoes ?? 0;
  const maxSerie = Math.max(1, ...(data?.serie ?? []).map((s) => s.visitas));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            Analytics da Landing de Vendas
          </DialogTitle>
          <DialogDescription>
            Rastreamento anônimo da página <code>/lp/</code>: visitas, seções vistas, cliques e origem do tráfego.
          </DialogDescription>
        </DialogHeader>

        {/* Período */}
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
              {d} dias
            </Button>
          ))}
        </div>

        {isLoading || !data ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-6 pt-1">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={<Eye className="h-4 w-4 text-sky-500" />} label="Visitas" value={data.resumo.visitas} />
              <Kpi icon={<Users className="h-4 w-4 text-indigo-500" />} label="Visitantes únicos" value={data.resumo.visitantes} />
              <Kpi icon={<MousePointerClick className="h-4 w-4 text-emerald-600" />} label="Cliques em CTA" value={data.resumo.ctaClicks} />
              <Kpi
                icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
                label="Taxa de clique (CTR)"
                value={`${(data.resumo.ctr * 100).toFixed(1)}%`}
                sub={`${data.resumo.sessoesComCta}/${data.resumo.sessoes} sessões`}
              />
              <Kpi icon={<Timer className="h-4 w-4 text-amber-500" />} label="Tempo médio" value={fmtTempo(data.resumo.tempoMedioSeg)} />
              <Kpi icon={<BarChart3 className="h-4 w-4 text-amber-500" />} label="Rolagem média" value={`${data.resumo.scrollMedioPct}%`} />
              <Kpi icon={<Users className="h-4 w-4 text-indigo-500" />} label="Sessões" value={data.resumo.sessoes} />
            </div>

            {/* Funil de seções */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Funil de seções (quantas sessões chegaram em cada parte)</h3>
              <div className="space-y-1.5">
                {SECOES.map((s) => {
                  const v = data.funnel[s.key] ?? 0;
                  const pct = sessoes > 0 ? Math.round((v / sessoes) * 100) : 0;
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className="text-xs w-32 shrink-0 text-muted-foreground">{s.label}</span>
                      <div className="flex-1 h-6 rounded bg-muted/50 overflow-hidden">
                        <div className="h-full bg-emerald-500/80 flex items-center px-2" style={{ width: `${Math.max(pct, v > 0 ? 4 : 0)}%` }}>
                          {pct >= 12 && <span className="text-[11px] font-medium text-white">{pct}%</span>}
                        </div>
                      </div>
                      <span className="text-xs w-16 shrink-0 text-right tabular-nums">{v} {pct < 12 ? `(${pct}%)` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Tendência diária */}
            {data.serie.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2">Visitas por dia</h3>
                <div className="flex items-end gap-1 h-24 border-b border-border pb-0">
                  {data.serie.map((s) => (
                    <div key={s.dia} className="flex-1 flex flex-col items-center justify-end group relative" title={`${s.dia}: ${s.visitas} visitas, ${s.conversoes} cliques`}>
                      <div className="w-full bg-sky-500/70 rounded-t" style={{ height: `${(s.visitas / maxSerie) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {data.serie[0]?.dia} — {data.serie[data.serie.length - 1]?.dia}
                </p>
              </section>
            )}

            <div className="grid md:grid-cols-2 gap-5">
              {/* CTAs */}
              <section>
                <h3 className="text-sm font-semibold mb-2">Cliques por botão (CTA)</h3>
                {data.ctas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum clique no período.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.ctas.map((c) => (
                      <div key={c.cta} className="flex items-center justify-between text-sm border-b border-border/60 py-1">
                        <span>{CTA_LABELS[c.cta] || c.cta}</span>
                        <span className="font-semibold tabular-nums">{c.cliques}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Fontes */}
              <section>
                <h3 className="text-sm font-semibold mb-2">Origem do tráfego</h3>
                {data.fontes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem dados no período.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.fontes.map((f) => (
                      <div key={f.fonte} className="flex items-center justify-between text-sm border-b border-border/60 py-1">
                        <span className="truncate mr-2">{f.fonte}</span>
                        <span className="font-semibold tabular-nums">{f.sessoes}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Recentes */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Visitas recentes</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Quando</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Dispositivo</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Origem</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recentes.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Nenhuma visita ainda.</td></tr>
                    ) : (
                      data.recentes.map((v, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 whitespace-nowrap">{v.quando}</td>
                          <td className="px-3 py-2">{v.device === "mobile" ? "📱 Mobile" : "💻 Desktop"}</td>
                          <td className="px-3 py-2 truncate max-w-[180px]" title={v.referrer || ""}>{v.fonte}</td>
                          <td className="px-3 py-2 text-muted-foreground">{v.ip}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
