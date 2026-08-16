import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmationDialog } from "@/components/ui/destructive-confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateBR } from "@/lib/date-br";

interface Cobranca { id_cobranca: number; tipo: "boleto" | "pix"; status: string; descricao: string; valor: string; vencimento: string }
const vazio = { tipo: "pix" as "pix" | "boleto", descricao: "", valor: "", vencimento: new Date().toISOString().slice(0, 10) };
const fmt = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export function CobrancasTab() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(vazio);
  const [cancelarId, setCancelarId] = useState<number | null>(null);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const { data: itens = [] } = useQuery<Cobranca[]>({ queryKey: ["financeiro", "cobrancas"], queryFn: async () => { const r = await fetch("/api/cobrancas", { headers }); if (!r.ok) throw new Error("Erro ao carregar cobranças"); return r.json(); } });
  const criar = useMutation({ mutationFn: async () => { const r = await fetch("/api/cobrancas", { method: "POST", headers, body: JSON.stringify({ ...form, valor: Number(form.valor) }) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Erro ao criar rascunho"); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["financeiro", "cobrancas"] }); setForm(vazio); toast({ title: "Rascunho criado" }); }, onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) });
  const cancelar = useMutation({ mutationFn: async (id: number) => { const r = await fetch(`/api/cobrancas/${id}`, { method: "DELETE", headers }); if (!r.ok) throw new Error("Não foi possível cancelar"); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["financeiro", "cobrancas"] }); setCancelarId(null); toast({ title: "Rascunho cancelado" }); }, onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) });
  return <div className="space-y-4">
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Estrutura preparada, integração pendente.</strong> Nenhum boleto, QR Code ou remessa bancária é gerado nesta etapa.</div>
    <div className="rounded-lg border p-4 grid gap-3 md:grid-cols-5">
      <div><Label>Tipo</Label><Select value={form.tipo} onValueChange={(tipo: "pix" | "boleto") => setForm(f => ({ ...f, tipo }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="boleto">Boleto</SelectItem></SelectContent></Select></div>
      <div className="md:col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
      <div><Label>Valor</Label><MoneyInput value={form.valor} onValueChange={valor => setForm(f => ({ ...f, valor }))} /></div>
      <div><Label>Vencimento</Label><Input type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} /></div>
      <Button className="md:col-span-5" disabled={!form.descricao || !form.valor || criar.isPending} onClick={() => criar.mutate()}><Plus className="h-4 w-4 mr-1" />Criar rascunho</Button>
    </div>
    <div className="rounded-lg border overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-muted/40"><th className="p-3 text-left">Cobrança</th><th className="p-3 text-left">Vencimento</th><th className="p-3 text-right">Valor</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{itens.length ? itens.map(i => <tr key={i.id_cobranca} className="border-t"><td className="p-3"><b>{i.descricao}</b><div className="text-xs text-muted-foreground uppercase">{i.tipo}</div></td><td className="p-3">{formatDateBR(i.vencimento)}</td><td className="p-3 text-right">{fmt(Number(i.valor))}</td><td className="p-3 text-center"><Badge variant="outline">{i.status}</Badge></td><td className="p-3 text-right">{i.status === "rascunho" ? <Button aria-label="Cancelar rascunho" size="icon" variant="ghost" onClick={() => setCancelarId(i.id_cobranca)}><Trash2 className="h-4 w-4" /></Button> : null}</td></tr>) : <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum rascunho de cobrança.</td></tr>}</tbody></table></div>
    <DestructiveConfirmationDialog open={cancelarId !== null} onOpenChange={open => !open && setCancelarId(null)} title="Cancelar rascunho?" description="Este rascunho de cobrança deixará de ficar disponível para edição." consequence="A operação não emite boleto, PIX nem movimenta saldo." confirmLabel="Cancelar rascunho" pending={cancelar.isPending} onConfirm={() => cancelarId !== null && cancelar.mutate(cancelarId)} />
  </div>;
}
