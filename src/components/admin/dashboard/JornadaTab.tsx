import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, TrendingUp, Users2 } from "lucide-react";
import { formatDateTimeBR } from "@/lib/date-br";

interface EmpresaJourney {
  id_empresa: number;
  nome_fantasia: string;
  cidade: string | null;
  estado: string | null;
  plano: string | null;
  ativo: boolean;
  created_at: string;
  ultimo_acesso: string | null;
  is_trial: boolean;
  is_paid: boolean;
  dias_restantes: number | null;
  loteamentos: number;
  lotes: number;
  vendas: number;
  pagamentos_pagos: number;
  motivos_ajuda: string[];
}

interface FunilResponse {
  funil: {
    cadastradas: number;
    comLoteamento: number;
    comLote: number;
    comVenda: number;
    comPagamento: number;
    convertidasPago: number;
  };
  precisaAjuda: EmpresaJourney[];
  trialsVencendo: EmpresaJourney[];
}

const MOTIVO_LABEL: Record<string, { label: string; className: string }> = {
  sem_uso: { label: "Sem uso no trial", className: "bg-amber-100 text-amber-700 border-amber-200" },
  sem_acesso: { label: "Sem acesso recente", className: "bg-slate-100 text-slate-700 border-slate-200" },
  trial_vencendo: { label: "Trial vencendo", className: "bg-red-100 text-red-700 border-red-200" },
};

const STAGES: { key: keyof FunilResponse["funil"]; label: string }[] = [
  { key: "cadastradas", label: "Cadastradas (trial iniciado)" },
  { key: "comLoteamento", label: "Criaram 1º loteamento" },
  { key: "comLote", label: "Cadastraram 1º lote" },
  { key: "comVenda", label: "Fizeram 1ª venda" },
  { key: "comPagamento", label: "Registraram 1º pagamento" },
  { key: "convertidasPago", label: "Converteram para pago" },
];

function fmt(date?: string | null) {
  if (!date) return "—";
  return formatDateTimeBR(date, date);
}

export function JornadaTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const { data, isLoading } = useQuery<FunilResponse>({
    queryKey: ["admin-dashboard", "funil"],
    queryFn: async () => {
      const r = await fetch("/api/admin/dashboard/funil", { headers });
      if (!r.ok) throw new Error("Erro ao buscar funil");
      return r.json();
    },
  });

  if (isLoading || !data) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  const { funil, precisaAjuda, trialsVencendo } = data;
  const base = funil.cadastradas || 1;
  const taxaConversao = funil.cadastradas > 0 ? (funil.convertidasPago / funil.cadastradas) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Taxa de conversão trial → pago</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-2xl font-bold">{taxaConversao.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">
                ({funil.convertidasPago}/{funil.cadastradas})
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Trials vencendo sem conversão</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="text-2xl font-bold text-red-500">{trialsVencendo.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Empresas que precisam de ajuda</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-2xl font-bold text-amber-600">{precisaAjuda.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users2 className="h-4 w-4 text-emerald-600" />
            Funil de jornada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {STAGES.map((stage) => {
            const valor = funil[stage.key];
            const pct = Math.max(4, Math.round((valor / base) * 100));
            return (
              <div key={stage.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{stage.label}</span>
                  <span className="font-medium">
                    {valor} <span className="text-muted-foreground">({Math.round((valor / base) * 100)}%)</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Precisa de ajuda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Precisa de ajuda
          </CardTitle>
        </CardHeader>
        <CardContent>
          {precisaAjuda.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma empresa com sinais de dificuldade no momento.
            </p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-semibold">Empresa</th>
                    <th className="px-4 py-2 text-left font-semibold">Cadastro</th>
                    <th className="px-4 py-2 text-left font-semibold">Último acesso</th>
                    <th className="px-4 py-2 text-left font-semibold">Dias restantes</th>
                    <th className="px-4 py-2 text-left font-semibold">Motivos</th>
                  </tr>
                </thead>
                <tbody>
                  {precisaAjuda.map((e) => (
                    <tr key={e.id_empresa} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{e.nome_fantasia}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{fmt(e.created_at)}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{fmt(e.ultimo_acesso)}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {e.dias_restantes != null ? e.dias_restantes : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {e.motivos_ajuda.map((m) => (
                            <Badge key={m} variant="outline" className={MOTIVO_LABEL[m]?.className}>
                              {MOTIVO_LABEL[m]?.label ?? m}
                            </Badge>
                          ))}
                        </div>
                      </td>
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
