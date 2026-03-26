import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Eye,
  Ban,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MapPin,
  User,
  DollarSign,
  ClipboardList,
  CalendarCheck,
  AlertCircle,
  ShoppingCart,
  Printer,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── Types ─────────────────────────────────────────────────────────────────
type VendaStatus = "aberta" | "quitada" | "cancelada";
type PagamentoSituacao = "aberto" | "pago";

interface VendaListItem {
  id_venda: number;
  cliente: string;
  lote: string;
  loteamento: string;
  data_venda: string;
  valor_entrada: number;
  parcelas: number;
  porcentagem: number;
  status: VendaStatus;
  valor_total: number;
}

interface Pagamento {
  id_pagamento: number;
  numero_parcela: number;
  situacao: PagamentoSituacao;
  vencimento: string;
  valor: string;
  pago_data: string | null;
  valor_pago: string | null;
  multa: string;
  juros: string;
}

interface VendaDetalhe {
  id_venda: number;
  id_cliente: number;
  id_lote: number;
  data_venda: string;
  valor_entrada: string;
  parcelas: number;
  porcentagem: string;
  status: VendaStatus;
  pagamentos: Pagamento[];
}

interface LoteDisponivel {
  id_lote: number;
  id_loteamento: number;
  lote: string;
  quadra: string;
  area: string | null;
  frente: string | null;
  fundo: string | null;
  status: "disponivel" | "vendido";
}

interface Loteamento {
  id_loteamento: number;
  nome: string;
  cidade: string | null;
  estado: string | null;
}

interface Cliente {
  id_cliente: number;
  nome: string;
  cpf: string | null;
  cnpj: string | null;
  cidade: string | null;
}

interface Conta {
  id_conta: number;
  apelido: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const fmtCurrency = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

const fmtDate = (d: string) => {
  if (!d) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
};

const statusConfig: Record<VendaStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  aberta: { label: "Aberta", variant: "default" },
  quitada: { label: "Quitada", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

// ─── Component ─────────────────────────────────────────────────────────────
const Vendas = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── list state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | VendaStatus>("all");

  // ── nova venda dialog
  const [novaVendaAberto, setNovaVendaAberto] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedLoteamento, setSelectedLoteamento] = useState<Loteamento | null>(null);
  const [selectedLote, setSelectedLote] = useState<LoteDisponivel | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteSearch, setClienteSearch] = useState("");

  // step 3 form fields
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split("T")[0]);
  const [valorLote, setValorLote] = useState("");
  const [valorEntrada, setValorEntrada] = useState("0");
  const [numParcelas, setNumParcelas] = useState("12");
  const [porcentagem, setPorcentagem] = useState("0");

  // ── success after create
  const [vendaCriada, setVendaCriada] = useState<{ id_venda: number; pagamentos: Pagamento[] } | null>(null);
  const [dialogSucessoAberto, setDialogSucessoAberto] = useState(false);

  // ── detail / baixa
  const [vendaDetalhe, setVendaDetalhe] = useState<VendaDetalhe | null>(null);
  const [vendaDetalheInfo, setVendaDetalheInfo] = useState<VendaListItem | null>(null);
  const [dialogDetalheAberto, setDialogDetalheAberto] = useState(false);
  const [parcelaParaBaixa, setParcelaParaBaixa] = useState<Pagamento | null>(null);
  const [dialogBaixaAberto, setDialogBaixaAberto] = useState(false);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaValor, setBaixaValor] = useState("");
  const [baixaConta, setBaixaConta] = useState("");

  // ── cadastro rápido de cliente (no step 2)
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteCpf, setNovoClienteCpf] = useState("");
  const [novoClienteFone, setNovoClienteFone] = useState("");
  const [novoClienteCidade, setNovoClienteCidade] = useState("");
  const [novoClienteEstado, setNovoClienteEstado] = useState("");

  // ── cancelar
  const [confirmarCancelamento, setConfirmarCancelamento] = useState<VendaListItem | null>(null);
  const [bloqueadoPorPagamentos, setBloqueadoPorPagamentos] = useState<{ venda: VendaListItem; id_cliente: number } | null>(null);

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: vendas = [], isLoading } = useQuery<VendaListItem[]>({
    queryKey: ["vendas"],
    queryFn: async () => {
      const r = await fetch("/api/vendas", { headers: { ...getAuthHeaders() } });
      if (!r.ok) throw new Error("Erro ao carregar vendas");
      const data = await r.json() as VendaListItem[];
      return data.map((v) => ({
        ...v,
        status: v.status as VendaStatus,
        valor_total: Number(v.valor_total ?? 0),
        valor_entrada: Number(v.valor_entrada ?? 0),
      }));
    },
  });

  const { data: loteamentos = [] } = useQuery<Loteamento[]>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const r = await fetch("/api/loteamentos", { headers: { ...getAuthHeaders() } });
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: todosLotes = [] } = useQuery<LoteDisponivel[]>({
    queryKey: ["lotes"],
    queryFn: async () => {
      const r = await fetch("/api/lotes", { headers: { ...getAuthHeaders() } });
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 2 * 60 * 1000,
    enabled: novaVendaAberto,
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["clientes-venda"],
    queryFn: async () => {
      const r = await fetch("/api/clientes?limit=100", { headers: { ...getAuthHeaders() } });
      if (!r.ok) throw new Error();
      const json = await r.json() as { data: Cliente[] };
      return json.data ?? [];
    },
    staleTime: 0,
    enabled: novaVendaAberto,
  });

  const { data: contas = [] } = useQuery<Conta[]>({
    queryKey: ["contas"],
    queryFn: async () => {
      const r = await fetch("/api/contas", { headers: { ...getAuthHeaders() } });
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: dialogBaixaAberto,
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const criarVendaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLote || !selectedCliente) throw new Error("Selecione lote e cliente");
      const body = {
        id_cliente: selectedCliente.id_cliente,
        id_lote: selectedLote.id_lote,
        data_venda: dataVenda,
        valor_entrada: Number(valorEntrada),
        parcelas: Number(numParcelas),
        porcentagem: Number(porcentagem),
        valor_lote: Number(valorLote),
      };
      const r = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      let data: unknown;
      try { data = await r.json(); } catch { data = null; }
      if (!r.ok) {
        const msg = typeof data === "object" && data !== null && "error" in data
          ? (data as { error: string }).error
          : "Erro ao criar venda";
        throw new Error(msg);
      }
      return data as VendaDetalhe;
    },
    onSuccess: (venda) => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      setNovaVendaAberto(false);
      setVendaCriada({ id_venda: venda.id_venda, pagamentos: venda.pagamentos ?? [] });
      setDialogSucessoAberto(true);
      resetNovaVenda();
    },
    onError: (err) => {
      toast({
        title: "Erro ao registrar venda",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const cancelarVendaMutation = useMutation({
    mutationFn: async (venda: VendaListItem) => {
      const r = await fetch(`/api/vendas/${venda.id_venda}/cancelar`, { method: "PATCH", headers: { ...getAuthHeaders() } });
      const data = await r.json().catch(() => null) as Record<string, unknown> | null;
      if (!r.ok) throw { ...data, _venda: venda };
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      setConfirmarCancelamento(null);
      toast({ title: "Venda cancelada com sucesso" });
    },
    onError: (err: unknown) => {
      const data = err as Record<string, unknown>;
      const venda = data._venda as VendaListItem | undefined;
      setConfirmarCancelamento(null);
      if (data?.error === "tem_pagamentos" && venda) {
        setTimeout(() => setBloqueadoPorPagamentos({ venda, id_cliente: Number(data.id_cliente) }), 300);
      } else {
        toast({
          title: "Erro ao cancelar",
          description: typeof data?.message === "string" ? data.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    },
  });

  const criarClienteRapidoMutation = useMutation({
    mutationFn: async () => {
      if (!novoClienteNome.trim()) throw new Error("Nome obrigatório");
      const body = {
        tipo: "f",
        nome: novoClienteNome.trim(),
        cpf: novoClienteCpf.trim() || undefined,
        fone_res: novoClienteFone.trim() || undefined,
        cidade: novoClienteCidade.trim() || undefined,
        estado: novoClienteEstado.trim() || undefined,
      };
      const r = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null) as Record<string, unknown> | null;
        throw new Error(typeof d?.error === "string" ? d.error : "Erro ao cadastrar cliente");
      }
      return r.json() as Promise<Cliente>;
    },
    onSuccess: (cliente) => {
      queryClient.invalidateQueries({ queryKey: ["clientes-venda"] });
      setSelectedCliente(cliente);
      setNovoClienteAberto(false);
      setNovoClienteNome("");
      setNovoClienteCpf("");
      setNovoClienteFone("");
      setNovoClienteCidade("");
      setNovoClienteEstado("");
      toast({ title: "Cliente cadastrado e selecionado" });
    },
    onError: (err) => {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    },
  });

  const darBaixaMutation = useMutation({
    mutationFn: async () => {
      if (!parcelaParaBaixa) throw new Error();
      const body: Record<string, unknown> = {
        pago_data: baixaData,
        valor_pago: Number(baixaValor),
      };
      if (baixaConta) body.id_conta = Number(baixaConta);
      const r = await fetch(`/api/pagamentos/${parcelaParaBaixa.id_pagamento}/baixa`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        let data: unknown;
        try { data = await r.json(); } catch { data = null; }
        const msg = typeof data === "object" && data !== null && "error" in data
          ? (data as { error: string }).error : "Erro ao dar baixa";
        throw new Error(msg);
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      if (vendaDetalheInfo) {
        // refresh detalhe
        fetchDetalhe(vendaDetalheInfo.id_venda);
      }
      setDialogBaixaAberto(false);
      setParcelaParaBaixa(null);
      toast({ title: "Baixa registrada com sucesso" });
    },
    onError: (err) => {
      toast({ title: "Erro ao dar baixa", description: err instanceof Error ? err.message : "", variant: "destructive" });
    },
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function resetNovaVenda() {
    setStep(1);
    setSelectedLoteamento(null);
    setSelectedLote(null);
    setSelectedCliente(null);
    setClienteSearch("");
    setDataVenda(new Date().toISOString().split("T")[0]);
    setValorLote("");
    setValorEntrada("0");
    setNumParcelas("12");
    setPorcentagem("0");
  }

  async function fetchDetalhe(id_venda: number) {
    try {
      const r = await fetch(`/api/vendas/${id_venda}`, { headers: { ...getAuthHeaders() } });
      if (!r.ok) throw new Error();
      const data = await r.json() as VendaDetalhe;
      setVendaDetalhe(data);
    } catch {
      toast({ title: "Erro ao carregar detalhe da venda", variant: "destructive" });
    }
  }

  function imprimirCarne() {
    if (!vendaCriada) return;
    const win = window.open("", "", "width=800,height=600");
    if (!win) {
      toast({ title: "Bloqueador de pop-ups ativado", variant: "destructive" });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Carnê - Venda #${vendaCriada.id_venda}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333; }
          .carnes-container { display: flex; flex-direction: column; gap: 40px; }
          .carne { border: 2px solid #333; padding: 20px; page-break-after: always; }
          .carne-header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; text-align: center; }
          .carne-title { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
          .carne-info { font-size: 11px; }
          .carne-content { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px; }
          .info-item { font-size: 11px; }
          .info-label { font-weight: bold; }
          .carne-details { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 15px 0; font-size: 11px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .carne-footer { font-size: 10px; margin-top: 15px; text-align: center; color: #666; }
          .carne-barcode { text-align: center; margin: 10px 0; font-family: 'Courier New', monospace; font-weight: bold; font-size: 16px; letter-spacing: 2px; }
          @media print {
            .carne { page-break-after: always; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="carnes-container">
          ${(vendaCriada.pagamentos ?? [])
            .sort((a, b) => a.numero_parcela - b.numero_parcela)
            .map((p) => `
              <div class="carne">
                <div class="carne-header">
                  <div class="carne-title">CARNÊ DE COBRANÇA</div>
                  <div class="carne-info">Venda #${vendaCriada.id_venda}</div>
                </div>
                <div class="carne-content">
                  <div class="info-item">
                    <div class="info-label">Parcela:</div>
                    <div>${String(p.numero_parcela).padStart(2, "0")}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Vencimento:</div>
                    <div>${fmtDate(p.vencimento)}</div>
                  </div>
                </div>
                <div class="carne-details">
                  <div class="detail-row">
                    <span><strong>Valor:</strong></span>
                    <span><strong>${fmtCurrency(p.valor)}</strong></span>
                  </div>
                  <div class="detail-row">
                    <span>Situação:</span>
                    <span>ABERTO</span>
                  </div>
                </div>
                <div class="carne-barcode">${String(p.numero_parcela).padStart(2, "0")}${vendaCriada.id_venda}</div>
                <div class="carne-footer">Imprima este carnê e apresente no pagamento</div>
              </div>
            `).join("")}
        </div>
        <script>
          setTimeout(() => { window.print(); }, 100);
        </script>
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  }

  function abrirDetalhe(venda: VendaListItem) {
    setVendaDetalheInfo(venda);
    setVendaDetalhe(null);
    setDialogDetalheAberto(true);
    fetchDetalhe(venda.id_venda);
  }

  function abrirBaixa(parcela: Pagamento) {
    setParcelaParaBaixa(parcela);
    setBaixaData(new Date().toISOString().split("T")[0]);
    setBaixaValor(Number(parcela.valor).toFixed(2).replace(".", ","));
    setBaixaConta(contas.length === 1 ? String(contas[0].id_conta) : "");
    setDialogBaixaAberto(true);
  }

  // ─── Derived ────────────────────────────────────────────────────────────────
  const lotesDisponiveis = useMemo(() =>
    todosLotes.filter((l) =>
      l.status === "disponivel" &&
      (!selectedLoteamento || l.id_loteamento === selectedLoteamento.id_loteamento)
    ),
    [todosLotes, selectedLoteamento]
  );

  const clientesFiltrados = useMemo(() =>
    clientes.filter((c) =>
      !clienteSearch.trim() ||
      c.nome.toLowerCase().includes(clienteSearch.toLowerCase()) ||
      (c.cpf && c.cpf.includes(clienteSearch)) ||
      (c.cnpj && c.cnpj.includes(clienteSearch))
    ),
    [clientes, clienteSearch]
  );

  const saldo = Math.max(0, Number(valorLote) - Number(valorEntrada));
  const valorParcela = Number(numParcelas) > 0 ? saldo / Number(numParcelas) : 0;
  const totalContrato = Number(valorEntrada) + saldo;

  const vendaFiltrada = vendas.filter((v) => {
    const matchSearch =
      v.cliente.toLowerCase().includes(search.toLowerCase()) ||
      v.lote.toLowerCase().includes(search.toLowerCase()) ||
      v.loteamento.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || v.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Carregando..." : `${vendas.length} venda${vendas.length !== 1 ? "s" : ""} registrada${vendas.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => { resetNovaVenda(); setNovaVendaAberto(true); }}>
            <Plus className="h-4 w-4" />
            Nova Venda
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, lote ou loteamento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "aberta", "quitada", "cancelada"] as const).map((s) => (
              <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} onClick={() => setFilterStatus(s)}>
                {s === "all" ? "Todas" : statusConfig[s].label}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Entrada</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcelas</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Juros</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vendaFiltrada.map((v) => (
                  <tr key={v.id_venda} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => abrirDetalhe(v)}>
                    <td className="px-5 py-3 font-medium">{v.cliente}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div>
                        <span>{v.lote}</span>
                        <p className="text-xs text-muted-foreground/70">{v.loteamento}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(v.data_venda)}</td>
                    <td className="px-5 py-3 font-semibold text-primary">{fmtCurrency(v.valor_total)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtCurrency(v.valor_entrada)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{v.parcelas}x</td>
                    <td className="px-5 py-3 text-muted-foreground">{v.porcentagem}%</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusConfig[v.status].variant}>{statusConfig[v.status].label}</Badge>
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhes" onClick={() => abrirDetalhe(v)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Cancelar venda"
                          disabled={v.status !== "aberta"}
                          onClick={() => setConfirmarCancelamento(v)}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && vendaFiltrada.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma venda encontrada</div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — NOVA VENDA (3 passos)
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={novaVendaAberto} onOpenChange={(open) => { if (!open) { setNovaVendaAberto(false); resetNovaVenda(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Nova Venda
            </DialogTitle>
            {/* Steps indicator */}
            <div className="flex items-center gap-2 pt-2">
              {([
                { n: 1, label: "Lote", icon: MapPin },
                { n: 2, label: "Cliente", icon: User },
                { n: 3, label: "Condições", icon: DollarSign },
              ] as const).map(({ n, label, icon: Icon }, i) => (
                <div key={n} className="flex items-center gap-2">
                  {i > 0 && <div className={`h-px flex-1 w-8 ${step > n - 1 ? "bg-primary" : "bg-border"}`} />}
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${step === n ? "bg-primary text-primary-foreground" : step > n ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-3 w-3" />
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {/* ── Step 1: Selecionar Lote ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>Loteamento</Label>
                  <Select
                    value={selectedLoteamento ? String(selectedLoteamento.id_loteamento) : ""}
                    onValueChange={(v) => {
                      const lot = loteamentos.find((l) => String(l.id_loteamento) === v) ?? null;
                      setSelectedLoteamento(lot);
                      setSelectedLote(null);
                    }}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione um loteamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {loteamentos.map((l) => (
                        <SelectItem key={l.id_loteamento} value={String(l.id_loteamento)}>
                          {l.nome}{l.cidade ? ` — ${l.cidade}${l.estado ? `/${l.estado}` : ""}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLoteamento && (
                  <div>
                    <Label>Selecione o Lote Disponível</Label>
                    <p className="text-xs text-muted-foreground mb-2">{lotesDisponiveis.length} lote(s) disponível(is)</p>
                    {lotesDisponiveis.length === 0 ? (
                      <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                        Nenhum lote disponível neste loteamento
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                        {lotesDisponiveis.map((lote) => (
                          <button
                            key={lote.id_lote}
                            type="button"
                            onClick={() => setSelectedLote(lote)}
                            className={`text-left p-3 rounded-lg border text-sm transition-all ${
                              selectedLote?.id_lote === lote.id_lote
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                          >
                            <p className="font-semibold">Lote {lote.lote}</p>
                            <p className="text-xs text-muted-foreground">Quadra {lote.quadra}</p>
                            {lote.area && <p className="text-xs text-muted-foreground">{lote.area} m²</p>}
                            {lote.frente && <p className="text-xs text-muted-foreground">Frente: {lote.frente}m</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedLote && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>
                      <span className="font-medium">Lote {selectedLote.lote}</span>
                      {" — "}Quadra {selectedLote.quadra}
                      {selectedLote.area && ` — ${selectedLote.area} m²`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Selecionar Cliente ── */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CPF/CNPJ..."
                      value={clienteSearch}
                      onChange={(e) => setClienteSearch(e.target.value)}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Cadastrar novo cliente"
                    onClick={() => setNovoClienteAberto(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {clientesFiltrados.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">Nenhum cliente encontrado</div>
                  ) : (
                    clientesFiltrados.map((c) => (
                      <button
                        key={c.id_cliente}
                        type="button"
                        onClick={() => setSelectedCliente(c)}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                          selectedCliente?.id_cliente === c.id_cliente
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.cpf ?? c.cnpj ?? "Sem documento"}{c.cidade ? ` · ${c.cidade}` : ""}
                            </p>
                          </div>
                          {selectedCliente?.id_cliente === c.id_cliente && (
                            <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── Step 3: Condições da Venda ── */}
            {step === 3 && (
              <div className="space-y-4">
                {/* Resumo lote + cliente */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-xs">
                    <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wide">Lote</p>
                    <p className="font-semibold">{selectedLoteamento?.nome}</p>
                    <p>Lote {selectedLote?.lote} · Quadra {selectedLote?.quadra}</p>
                    {selectedLote?.area && <p>{selectedLote.area} m²</p>}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-xs">
                    <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wide">Cliente</p>
                    <p className="font-semibold">{selectedCliente?.nome}</p>
                    <p>{selectedCliente?.cpf ?? selectedCliente?.cnpj ?? "—"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="data_venda">Data da Venda</Label>
                    <Input id="data_venda" type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="valor_lote">Valor do Lote (R$)</Label>
                    <Input
                      id="valor_lote"
                      type="number" min="0" step="0.01" placeholder="0,00"
                      value={valorLote}
                      onChange={(e) => setValorLote(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="valor_entrada">Entrada (R$)</Label>
                    <Input
                      id="valor_entrada"
                      type="number" min="0" step="0.01" placeholder="0,00"
                      value={valorEntrada}
                      onChange={(e) => setValorEntrada(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="num_parcelas">Número de Parcelas</Label>
                    <Input
                      id="num_parcelas"
                      type="number" min="1" step="1"
                      value={numParcelas}
                      onChange={(e) => setNumParcelas(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="porcentagem">Juros ao Mês (%)</Label>
                    <Input
                      id="porcentagem"
                      type="number" min="0" step="0.01" placeholder="0"
                      value={porcentagem}
                      onChange={(e) => setPorcentagem(e.target.value)}
                      className="mt-1.5 max-w-[200px]"
                    />
                  </div>
                </div>

                {/* Cálculo preview */}
                {valorLote && Number(valorLote) > 0 && (
                  <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-2 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-3">Resumo da Venda</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor do lote</span>
                      <span className="font-medium">{fmtCurrency(valorLote)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entrada</span>
                      <span className="font-medium">{fmtCurrency(valorEntrada || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo a financiar</span>
                      <span className="font-medium">{fmtCurrency(saldo)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">{numParcelas}x de</span>
                      <span className="font-semibold text-primary">{fmtCurrency(valorParcela)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Total do contrato</span>
                      <span className="font-bold text-primary">{fmtCurrency(totalContrato)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Vencimentos a partir de {fmtDate(new Date(new Date(dataVenda).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-3 flex-row justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3);
                else { setNovaVendaAberto(false); resetNovaVenda(); }
              }}
              className="gap-1"
            >
              {step > 1 && <ChevronLeft className="h-4 w-4" />}
              {step === 1 ? "Cancelar" : "Voltar"}
            </Button>

            {step < 3 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as 2 | 3)}
                disabled={
                  (step === 1 && !selectedLote) ||
                  (step === 2 && !selectedCliente)
                }
                className="gap-1"
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => criarVendaMutation.mutate()}
                disabled={
                  criarVendaMutation.isPending ||
                  !valorLote || Number(valorLote) <= 0 ||
                  !dataVenda || Number(numParcelas) < 1
                }
                className="gap-2"
              >
                {criarVendaMutation.isPending ? "Registrando..." : (
                  <>
                    <ClipboardList className="h-4 w-4" />
                    Registrar Venda
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — SUCESSO (venda criada + parcelas)
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogSucessoAberto} onOpenChange={setDialogSucessoAberto}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Venda registrada com sucesso!
            </DialogTitle>
            <DialogDescription>
              Venda #{vendaCriada?.id_venda} — {vendaCriada?.pagamentos.length ?? 0} parcela(s) geradas automaticamente
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">#</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Vencimento</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground text-xs">Valor</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(vendaCriada?.pagamentos ?? [])
                  .sort((a, b) => a.numero_parcela - b.numero_parcela)
                  .map((p) => (
                    <tr key={p.id_pagamento} className="hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{String(p.numero_parcela).padStart(2, "0")}</td>
                      <td className="py-2 px-3 text-muted-foreground">{fmtDate(p.vencimento)}</td>
                      <td className="py-2 px-3 text-right font-medium">{fmtCurrency(p.valor)}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-xs">Aberto</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="border-t border-border pt-3 flex-row justify-between gap-2">
            <Button variant="outline" onClick={() => imprimirCarne()} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir Carnê
            </Button>
            <Button onClick={() => setDialogSucessoAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — DETALHE DA VENDA + PARCELAS + BAIXA
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogDetalheAberto} onOpenChange={(open) => { if (!open) { setDialogDetalheAberto(false); setVendaDetalhe(null); setVendaDetalheInfo(null); } }}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Venda #{vendaDetalheInfo?.id_venda} — {vendaDetalheInfo?.cliente}
            </DialogTitle>
            {vendaDetalheInfo && (
              <>
                <DialogDescription className="text-xs">
                  {vendaDetalheInfo.lote} · {vendaDetalheInfo.loteamento} · Data: {fmtDate(vendaDetalheInfo.data_venda)} · Total: <strong>{fmtCurrency(vendaDetalheInfo.valor_total)}</strong>
                </DialogDescription>
                <Badge variant={statusConfig[vendaDetalheInfo.status].variant} className="text-xs h-5 self-start">
                  {statusConfig[vendaDetalheInfo.status].label}
                </Badge>
              </>
            )}
          </DialogHeader>

          {/* KPIs */}
          {vendaDetalheInfo && vendaDetalhe && (
            <div className="grid grid-cols-3 gap-3 py-1">
              {[
                { label: "Entrada", value: fmtCurrency(vendaDetalheInfo.valor_entrada) },
                { label: "Parcelas", value: `${vendaDetalheInfo.parcelas}x · ${vendaDetalheInfo.porcentagem}% a.m.` },
                {
                  label: "Pagas",
                  value: `${vendaDetalhe.pagamentos.filter((p) => p.situacao === "pago").length} / ${vendaDetalhe.pagamentos.length}`,
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-semibold text-sm mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Parcelas table */}
          <div className="flex-1 overflow-y-auto border border-border rounded-lg">
            {!vendaDetalhe ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando parcelas...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Parcela</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Vencimento</th>
                    <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground">Valor</th>
                    <th className="text-center px-4 py-2.5 font-medium text-xs text-muted-foreground">Situação</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Pago em</th>
                    <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...vendaDetalhe.pagamentos]
                    .sort((a, b) => a.numero_parcela - b.numero_parcela)
                    .map((p) => {
                      const atrasado = p.situacao === "aberto" && new Date(p.vencimento) < new Date(new Date().toDateString());
                      return (
                        <tr key={p.id_pagamento} className={`hover:bg-muted/30 transition-colors ${atrasado ? "bg-destructive/5" : ""}`}>
                          <td className="px-4 py-2.5 font-medium">{String(p.numero_parcela).padStart(2, "0")}</td>
                          <td className={`px-4 py-2.5 ${atrasado ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {fmtDate(p.vencimento)}
                            {atrasado && <span className="ml-1 text-xs">(atrasado)</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">{fmtCurrency(p.valor)}</td>
                          <td className="px-4 py-2.5 text-center">
                            {p.situacao === "pago" ? (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Pago</Badge>
                            ) : (
                              <Badge variant={atrasado ? "destructive" : "outline"} className="text-xs">
                                {atrasado ? "Atrasado" : "Aberto"}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            {p.pago_data ? (
                              <div>
                                <span>{fmtDate(p.pago_data)}</span>
                                {p.valor_pago && <span className="block text-foreground font-medium">{fmtCurrency(p.valor_pago)}</span>}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {p.situacao === "aberto" && vendaDetalheInfo?.status === "aberta" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                                onClick={() => abrirBaixa(p)}
                              >
                                <CalendarCheck className="h-3 w-3" />
                                Baixa
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" onClick={() => setDialogDetalheAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — DAR BAIXA
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogBaixaAberto} onOpenChange={(open) => { if (!open) { setDialogBaixaAberto(false); setParcelaParaBaixa(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-green-600" />
              Dar Baixa — Parcela {parcelaParaBaixa?.numero_parcela && String(parcelaParaBaixa.numero_parcela).padStart(2, "0")}
            </DialogTitle>
            {parcelaParaBaixa && (
              <DialogDescription>
                Vencimento: {fmtDate(parcelaParaBaixa.vencimento)} · Valor: {fmtCurrency(parcelaParaBaixa.valor)}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="baixa_data">Data do Pagamento</Label>
              <Input id="baixa_data" type="date" value={baixaData} onChange={(e) => setBaixaData(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="baixa_valor">Valor Recebido (R$)</Label>
              <Input
                id="baixa_valor"
                type="number" min="0.01" step="0.01"
                value={baixaValor}
                onChange={(e) => setBaixaValor(e.target.value)}
                className="mt-1.5"
              />
            </div>
            {contas.length > 0 && (
              <div>
                <Label>Conta</Label>
                <Select value={baixaConta} onValueChange={setBaixaConta}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id_conta} value={String(c.id_conta)}>{c.apelido}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {contas.length === 0 && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                Nenhuma conta cadastrada. Acesse Configurações para cadastrar.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogBaixaAberto(false)}>Cancelar</Button>
            <Button
              onClick={() => darBaixaMutation.mutate()}
              disabled={darBaixaMutation.isPending || !baixaData || !baixaValor || Number(baixaValor) <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {darBaixaMutation.isPending ? "Salvando..." : "Confirmar Baixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — CADASTRO RÁPIDO DE CLIENTE
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={novoClienteAberto} onOpenChange={(open) => { if (!open) setNovoClienteAberto(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Novo Cliente
            </DialogTitle>
            <DialogDescription>Preencha os dados essenciais para cadastrar rapidamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label htmlFor="nc_nome">Nome completo *</Label>
              <Input id="nc_nome" value={novoClienteNome} onChange={(e) => setNovoClienteNome(e.target.value)} placeholder="Nome do cliente" className="mt-1.5" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nc_cpf">CPF</Label>
                <Input id="nc_cpf" value={novoClienteCpf} onChange={(e) => setNovoClienteCpf(e.target.value)} placeholder="000.000.000-00" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="nc_fone">Telefone</Label>
                <Input id="nc_fone" value={novoClienteFone} onChange={(e) => setNovoClienteFone(e.target.value)} placeholder="(00) 00000-0000" className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="nc_cidade">Cidade</Label>
                <Input id="nc_cidade" value={novoClienteCidade} onChange={(e) => setNovoClienteCidade(e.target.value)} placeholder="Cidade" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="nc_estado">UF</Label>
                <Input id="nc_estado" value={novoClienteEstado} onChange={(e) => setNovoClienteEstado(e.target.value)} placeholder="CE" maxLength={2} className="mt-1.5" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoClienteAberto(false)}>Cancelar</Button>
            <Button
              onClick={() => criarClienteRapidoMutation.mutate()}
              disabled={!novoClienteNome.trim() || criarClienteRapidoMutation.isPending}
            >
              {criarClienteRapidoMutation.isPending ? "Salvando..." : "Cadastrar e selecionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          ALERT — CONFIRMAR CANCELAMENTO
      ══════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={!!confirmarCancelamento} onOpenChange={(open) => { if (!open) setConfirmarCancelamento(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cancelar a venda do cliente <span className="font-semibold">{confirmarCancelamento?.cliente}</span>?
              O lote voltará a ficar disponível. As parcelas abertas serão mantidas como registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => confirmarCancelamento && cancelarVendaMutation.mutate(confirmarCancelamento)}
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════════════════════════════════
          ALERT — CANCELAMENTO BLOQUEADO POR PAGAMENTOS
      ══════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={!!bloqueadoPorPagamentos} onOpenChange={(open) => { if (!open) setBloqueadoPorPagamentos(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Cancelamento bloqueado
            </AlertDialogTitle>
            <AlertDialogDescription>
              A venda do cliente <span className="font-semibold">{bloqueadoPorPagamentos?.venda.cliente}</span> possui
              parcelas já pagas. Para cancelar a venda, você precisa primeiro cancelar os pagamentos realizados.
              <br /><br />
              Clique em <span className="font-semibold">"Ir para Pagamentos"</span> para visualizar e cancelar os
              pagamentos deste cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const idCliente = bloqueadoPorPagamentos?.id_cliente;
                setBloqueadoPorPagamentos(null);
                navigate(`/pagamentos?id_cliente=${idCliente}`);
              }}
            >
              Ir para Pagamentos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Vendas;
