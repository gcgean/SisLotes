import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-br";

interface FaixaAging { faixa: string; quantidade: number; total: number }
interface AgingResponse { dataReferencia: string; receber: FaixaAging[]; pagar: FaixaAging[] }
const moeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

function TabelaAging({ titulo, itens, tipo }: { titulo: string; itens: FaixaAging[]; tipo: "receber" | "pagar" }) {
  const Icone = tipo === "receber" ? ArrowDownToLine : ArrowUpFromLine;
  const total = itens.reduce((soma, item) => soma + item.total, 0);
  const quantidade = itens.reduce((soma, item) => soma + item.quantidade, 0);
  return <div className="glass-card rounded-lg overflow-hidden">
    <div className="flex items-center gap-3 border-b p-5"><div className="rounded-lg bg-muted p-2 text-primary"><Icone className="h-5 w-5" /></div><div><h2 className="font-semibold">{titulo}</h2><p className="text-xs text-muted-foreground">Somente parcelas vencidas e ainda em aberto</p></div></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="px-5 py-3 text-left font-medium text-muted-foreground">Dias em atraso</th><th className="px-5 py-3 text-right font-medium text-muted-foreground">Parcelas</th><th className="px-5 py-3 text-right font-medium text-muted-foreground">Saldo em aberto</th><th className="px-5 py-3 text-right font-medium text-muted-foreground">Participação</th></tr></thead><tbody>{itens.map(item => <tr className="border-b last:border-0" key={item.faixa}><td className="px-5 py-3 font-medium">{item.faixa} dias</td><td className="px-5 py-3 text-right">{item.quantidade}</td><td className="px-5 py-3 text-right">{moeda(item.total)}</td><td className="px-5 py-3 text-right text-muted-foreground">{total > 0 ? `${(item.total / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</td></tr>)}</tbody><tfoot><tr className="border-t-2 bg-muted/30"><td className="px-5 py-3 font-bold">Total vencido</td><td className="px-5 py-3 text-right font-bold">{quantidade}</td><td className="px-5 py-3 text-right font-bold text-primary">{moeda(total)}</td><td /></tr></tfoot></table></div>
  </div>;
}

export function AgingReport() {
  const { token } = useAuth();
  const [dataReferencia, setDataReferencia] = useState("");
  const { data, isLoading, error } = useQuery<AgingResponse>({ queryKey: ["relatorios", "aging", dataReferencia], queryFn: async () => { const params = dataReferencia ? `?data_referencia=${dataReferencia}` : ""; const response = await fetch(`/api/relatorios/aging${params}`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error("Não foi possível carregar o aging financeiro"); return response.json(); } });
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">Aging Financeiro</h2><p className="text-sm text-muted-foreground">Posição dos títulos vencidos, agrupados pelo tempo de atraso.</p></div><div className="w-full sm:w-48"><Label htmlFor="aging-data">Data de referência</Label><Input id="aging-data" type="date" value={dataReferencia || data?.dataReferencia || ""} onChange={event => setDataReferencia(event.target.value)} /></div></div>
    {isLoading ? <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Carregando aging...</div> : error ? <div className="flex items-center gap-2 rounded-lg border border-destructive/30 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{error.message}</div> : data ? <div className="grid gap-4 xl:grid-cols-2"><TabelaAging titulo="Contas a receber" itens={data.receber} tipo="receber" /><TabelaAging titulo="Contas a pagar" itens={data.pagar} tipo="pagar" /></div> : null}
  </div>;
}
