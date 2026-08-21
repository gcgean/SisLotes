import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonitorSmartphone, Smartphone, Tablet, Monitor } from "lucide-react";

interface AcessoRegistro {
  id: number;
  data_hora: string;
  ip_address: string | null;
  dispositivo: "Celular" | "Tablet" | "Desktop" | "Desconhecido" | null;
  navegador: string | null;
  sistema_operacional: string | null;
  login: string;
  empresa: string;
}

function IconeDispositivo({ tipo }: { tipo: AcessoRegistro["dispositivo"] }) {
  if (tipo === "Celular") return <Smartphone className="h-3.5 w-3.5" />;
  if (tipo === "Tablet") return <Tablet className="h-3.5 w-3.5" />;
  if (tipo === "Desktop") return <Monitor className="h-3.5 w-3.5" />;
  return <MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground" />;
}

function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function AcessosTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const { data, isLoading } = useQuery<AcessoRegistro[]>({
    queryKey: ["admin-dashboard", "acessos"],
    queryFn: async () => {
      const r = await fetch("/api/admin/dashboard/acessos?limite=200", { headers });
      if (!r.ok) throw new Error("Erro ao buscar acessos");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4 text-emerald-600" />
          Últimos acessos ao sistema
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          IP e dispositivo de cada login. A localização exata não é calculada — apenas o IP de origem.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum acesso registrado ainda.</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-4 py-2 text-left font-semibold">Quando</th>
                  <th className="px-4 py-2 text-left font-semibold">Usuário</th>
                  <th className="px-4 py-2 text-left font-semibold">Empresa</th>
                  <th className="px-4 py-2 text-left font-semibold">Dispositivo</th>
                  <th className="px-4 py-2 text-left font-semibold">Navegador / SO</th>
                  <th className="px-4 py-2 text-left font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{fmtDataHora(a.data_hora)}</td>
                    <td className="px-4 py-2 font-medium">{a.login}</td>
                    <td className="px-4 py-2">{a.empresa}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <IconeDispositivo tipo={a.dispositivo} />
                        {a.dispositivo ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {[a.navegador, a.sistema_operacional].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{a.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
