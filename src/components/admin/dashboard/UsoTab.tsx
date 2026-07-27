import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, ArrowUpDown, Phone, Mail, MessageCircle } from "lucide-react";
import { formatDateTimeBR } from "@/lib/date-br";

// Monta link do WhatsApp a partir de um telefone brasileiro (adiciona DDI 55 se faltar)
function waLink(telefone: string | null): string | null {
  if (!telefone) return null;
  let d = telefone.replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}`;
}

interface EmpresaJourney {
  id_empresa: number;
  nome_fantasia: string;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  email: string | null;
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

interface TimelineEvento {
  id_hub_event: number;
  event_type: string;
  event_source: string;
  status: string | null;
  amount: string | null;
  created_at: string;
}

interface TimelineCobranca {
  id_hub_charge: number;
  origin_type: string;
  status: string | null;
  amount: string | null;
  created_at: string;
}

type SortKey = "nome_fantasia" | "created_at" | "ultimo_acesso" | "loteamentos" | "lotes" | "vendas" | "pagamentos_pagos";

function fmt(date?: string | null) {
  if (!date) return "—";
  return formatDateTimeBR(date, date);
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 font-semibold hover:text-foreground"
    >
      {label}
      {active ? (
        dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

export function UsoTab() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<EmpresaJourney | null>(null);

  const { data: empresas = [], isLoading } = useQuery<EmpresaJourney[]>({
    queryKey: ["admin-dashboard", "empresas"],
    queryFn: async () => {
      const r = await fetch("/api/admin/dashboard/empresas", { headers });
      if (!r.ok) throw new Error("Erro ao buscar uso do sistema");
      return r.json();
    },
  });

  const timelineQuery = useQuery<{ eventos: TimelineEvento[]; cobrancas: TimelineCobranca[] }>({
    queryKey: ["admin-dashboard", "timeline", selected?.id_empresa],
    enabled: Boolean(selected),
    queryFn: async () => {
      const r = await fetch(`/api/admin/dashboard/empresas/${selected!.id_empresa}/timeline`, { headers });
      if (!r.ok) throw new Error("Erro ao buscar timeline");
      return r.json();
    },
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const list = empresas.filter((e) =>
      [e.nome_fantasia, e.cidade, e.estado].join(" ").toLowerCase().includes(term)
    );
    const sorted = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return sorted;
  }, [empresas, search, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por nome, cidade, estado…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">
                <SortHeader label="Empresa" active={sortKey === "nome_fantasia"} dir={sortDir} onClick={() => toggleSort("nome_fantasia")} />
              </th>
              <th className="px-4 py-3 text-left font-semibold">Contato</th>
              <th className="px-4 py-3 text-left font-semibold">Plano</th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Cadastro" active={sortKey === "created_at"} dir={sortDir} onClick={() => toggleSort("created_at")} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Último acesso" active={sortKey === "ultimo_acesso"} dir={sortDir} onClick={() => toggleSort("ultimo_acesso")} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Loteamentos" active={sortKey === "loteamentos"} dir={sortDir} onClick={() => toggleSort("loteamentos")} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Lotes" active={sortKey === "lotes"} dir={sortDir} onClick={() => toggleSort("lotes")} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Vendas" active={sortKey === "vendas"} dir={sortDir} onClick={() => toggleSort("vendas")} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Pagamentos pagos" active={sortKey === "pagamentos_pagos"} dir={sortDir} onClick={() => toggleSort("pagamentos_pagos")} />
              </th>
              <th className="px-4 py-3 text-left font-semibold">Precisa ajuda?</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Nenhuma empresa encontrada.</td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr
                  key={e.id_empresa}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelected(e)}
                >
                  <td className="px-4 py-3 font-medium">
                    {e.nome_fantasia}
                    {(e.cidade || e.estado) && (
                      <div className="text-xs text-muted-foreground font-normal">
                        {[e.cidade, e.estado].filter(Boolean).join("/")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                    {e.telefone || e.email ? (
                      <div className="flex items-center gap-2">
                        {waLink(e.telefone) && (
                          <a
                            href={waLink(e.telefone)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`WhatsApp: ${e.telefone}`}
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span className="text-xs">{e.telefone}</span>
                          </a>
                        )}
                        {!e.telefone && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                            <Phone className="h-3.5 w-3.5" /> —
                          </span>
                        )}
                        {e.email && (
                          <a
                            href={`mailto:${e.email}`}
                            title={e.email}
                            className="inline-flex items-center text-sky-600 hover:text-sky-700"
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Sem contato</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.plano ? <Badge variant="outline">{e.plano}</Badge> : <span className="text-muted-foreground">—</span>}
                    {e.is_trial && <Badge className="ml-1 bg-amber-100 text-amber-700 border-amber-200">Trial</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(e.created_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(e.ultimo_acesso)}</td>
                  <td className="px-4 py-3">{e.loteamentos}</td>
                  <td className="px-4 py-3">{e.lotes}</td>
                  <td className="px-4 py-3">{e.vendas}</td>
                  <td className="px-4 py-3">{e.pagamentos_pagos}</td>
                  <td className="px-4 py-3">
                    {e.motivos_ajuda.length > 0 ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        {e.motivos_ajuda.length} sinal(is)
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.nome_fantasia}</DialogTitle>
            <DialogDescription>Linha do tempo de billing (trial → checkout → pago)</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {(selected.telefone || selected.email) && (
                <div className="flex flex-wrap items-center gap-2">
                  {waLink(selected.telefone) && (
                    <a
                      href={waLink(selected.telefone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp {selected.telefone}
                    </a>
                  )}
                  {selected.email && (
                    <a
                      href={`mailto:${selected.email}`}
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                      <Mail className="h-4 w-4" /> {selected.email}
                    </a>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-lg border p-2">
                  <div className="text-lg font-bold">{selected.loteamentos}</div>
                  <div className="text-xs text-muted-foreground">Loteamentos</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-lg font-bold">{selected.lotes}</div>
                  <div className="text-xs text-muted-foreground">Lotes</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-lg font-bold">{selected.vendas}</div>
                  <div className="text-xs text-muted-foreground">Vendas</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-lg font-bold">{selected.pagamentos_pagos}</div>
                  <div className="text-xs text-muted-foreground">Pagos</div>
                </div>
              </div>

              {timelineQuery.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando timeline…</p>
              ) : (
                <div className="space-y-2">
                  {[...(timelineQuery.data?.eventos ?? []), ...(timelineQuery.data?.cobrancas ?? [])]
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((item, i) => {
                      const isEvento = "event_type" in item;
                      return (
                        <div key={i} className="flex items-start gap-2 text-sm border-l-2 border-emerald-500 pl-3 py-1">
                          <div className="flex-1">
                            <div className="font-medium">
                              {isEvento ? (item as TimelineEvento).event_type : `Cobrança (${(item as TimelineCobranca).origin_type})`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.status ?? "—"} {item.amount ? `· R$ ${item.amount}` : ""} · {fmt(item.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {(timelineQuery.data?.eventos.length ?? 0) === 0 && (timelineQuery.data?.cobrancas.length ?? 0) === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum evento de billing registrado para esta empresa.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
