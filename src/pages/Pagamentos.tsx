import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  User,
  X,
  Printer,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gerarReciboParcela } from "@/utils/reciboParcela";
import { formatDateBR, parseBrDate, toIsoDateFromBR } from "@/lib/date-br";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type PagamentoSituacao = "aberto" | "pago" | "atrasado";

interface ClienteApi {
  id_cliente: number;
  nome: string;
  cpf?: string | null;
}

interface ContaApi {
  id_conta: number;
  apelido: string;
  titular: string;
  agencia: string;
  conta: string;
  convenio?: string | null;
}

// EmpresaInfo importada de @/utils/reciboParcela (ReciboEmpresa)

interface PagamentoApi {
  id_pagamento: number;
  numero_parcela: number;
  tipo: string;
  situacao: "aberto" | "pago";
  vencimento: string;
  valor: string;
  pago_data: string | null;
  valor_pago: string | null;
  multa?: string | null;
  juros?: string | null;
  venda?: {
    parcelas: number;
    cliente?: { nome: string };
    lote?: {
      quadra: string;
      lote: string;
      loteamento?: { id_loteamento: number; nome: string };
    };
  };
}

interface Pagamento {
  id: number;
  cliente: string;
  lote: string;
  loteamento: string;
  numero_parcela: number;
  parcelas: number;
  tipo: string;
  situacao: PagamentoSituacao;
  vencimento: string;
  valor: number;
  pago_data?: string;
  valor_pago?: number;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const todayStr = () => formatDateBR(new Date(), "");

const getDiasAtraso = (vencimentoStr: string) => {
  const venc = parseBrDate(vencimentoStr);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  venc.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
};

const calcularEncargos = (valor: number, diasAtraso: number) => {
  if (diasAtraso <= 0) return { multa: 0, juros: 0, total: valor };
  const multa = valor * 0.02;
  const juros = valor * 0.002 * diasAtraso;
  return { multa, juros, total: valor + multa + juros };
};

function getAuthHeaders(): Record<string, string> {
  const token = window.localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


// ─── Componente principal ─────────────────────────────────────────────────────

const Pagamentos = () => {
  const queryClient = useQueryClient();

  // ── Estado de busca de cliente ──
  const [searchCliente, setSearchCliente] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteApi | null>(null);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Abas ──
  const [aba, setAba] = useState<"abertas" | "pagas">("abertas");

  // ── Filtros compartilhados: loteamento e lote ──
  const [filtroLoteamento, setFiltroLoteamento] = useState("all");
  const [filtroLote, setFiltroLote] = useState("all");

  // ── Seleção múltipla (aba Abertas) ──
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  // ── Dialog de baixa ──
  const [baixaOpen, setBaixaOpen] = useState(false);
  const [baixaData, setBaixaData] = useState(todayStr());
  const [baixaContaId, setBaixaContaId] = useState("");

  // ── Dialog de recibo (reimprimir do histórico) ──
  const [reciboDialogOpen, setReciboDialogOpen] = useState(false);
  const [pagamentoParaRecibo, setPagamentoParaRecibo] = useState<Pagamento | null>(null);

  // ─── Busca de clientes (autocomplete) ────────────────────────────────────

  const { data: clientes = [] } = useQuery<ClienteApi[]>({
    queryKey: ["clientes-busca", searchCliente],
    queryFn: async () => {
      if (searchCliente.trim().length < 2) return [];
      const params = new URLSearchParams({ search: searchCliente, limit: "20" });
      const res = await fetch(`/api/clientes?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? json) as ClienteApi[];
    },
    enabled: searchCliente.trim().length >= 2 && !clienteSelecionado,
  });

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSugestoes(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Query: Contas Bancárias ─────────────────────────────────────────────

  const { data: contasBancarias = [] } = useQuery<ContaApi[]>({
    queryKey: ["contas-bancarias"],
    queryFn: async () => {
      const res = await fetch("/api/contas", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json() as Promise<ContaApi[]>;
    },
  });

  // ─── Query: Dados da Empresa ─────────────────────────────────────────────

  const { data: empresaInfo } = useQuery<ReciboEmpresa | null>({
    queryKey: ["empresa-info"],
    queryFn: async () => {
      const res = await fetch("/api/empresas/minha", { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json() as Promise<ReciboEmpresa>;
    },
  });

  // ─── Query: parcelas ABERTAS do cliente (sem filtro de data) ─────────────

  const {
    data: pagamentosAbertos = [],
    isLoading: loadingAbertos,
  } = useQuery<Pagamento[]>({
    queryKey: ["pagamentos-abertos", clienteSelecionado?.id_cliente],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clienteSelecionado) params.set("id_cliente", String(clienteSelecionado.id_cliente));

      const res = await fetch(`/api/pagamentos?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao carregar pagamentos");
      const json: PagamentoApi[] = await res.json();

      const hoje = new Date();

      return json
        .filter((p) => p.situacao !== "pago")
        .map<Pagamento>((p) => {
          const venc = new Date(p.vencimento);
          venc.setHours(0, 0, 0, 0);
          const hojeCopy = new Date(hoje);
          hojeCopy.setHours(0, 0, 0, 0);
          const situacao: PagamentoSituacao = venc < hojeCopy ? "atrasado" : "aberto";

          return {
            id: p.id_pagamento,
            cliente: p.venda?.cliente?.nome ?? "",
            lote: p.venda?.lote ? `Quadra ${p.venda.lote.quadra} - Lote ${p.venda.lote.lote}` : "",
            loteamento: p.venda?.lote?.loteamento?.nome ?? "",
            numero_parcela: p.numero_parcela,
            parcelas: p.venda?.parcelas ?? 0,
            tipo: p.tipo,
            situacao,
            vencimento: formatDateBR(p.vencimento, p.vencimento),
            valor: Number(p.valor),
          };
        })
        .sort((a, b) => parseBrDate(a.vencimento).getTime() - parseBrDate(b.vencimento).getTime());
    },
    enabled: !!clienteSelecionado,
  });

  // ─── Query: parcelas PAGAS do cliente (sem filtro de data) ──────────────

  const {
    data: pagamentosPagos = [],
    isLoading: loadingPagos,
  } = useQuery<Pagamento[]>({
    queryKey: ["pagamentos-pagos", clienteSelecionado?.id_cliente],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clienteSelecionado) params.set("id_cliente", String(clienteSelecionado.id_cliente));

      const res = await fetch(`/api/pagamentos?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao carregar pagamentos");
      const json: PagamentoApi[] = await res.json();

      return json
        .filter((p) => p.situacao === "pago")
        .map<Pagamento>((p) => ({
          id: p.id_pagamento,
          cliente: p.venda?.cliente?.nome ?? "",
          lote: p.venda?.lote ? `Quadra ${p.venda.lote.quadra} - Lote ${p.venda.lote.lote}` : "",
          loteamento: p.venda?.lote?.loteamento?.nome ?? "",
          numero_parcela: p.numero_parcela,
          parcelas: p.venda?.parcelas ?? 0,
          tipo: p.tipo,
          situacao: "pago",
          vencimento: formatDateBR(p.vencimento, p.vencimento),
          valor: Number(p.valor),
          pago_data: p.pago_data ? formatDateBR(p.pago_data, p.pago_data) : undefined,
          valor_pago: p.valor_pago != null ? Number(p.valor_pago) : undefined,
        }))
        .sort((a, b) => {
          const da = a.pago_data ? parseBrDate(a.pago_data).getTime() : 0;
          const db = b.pago_data ? parseBrDate(b.pago_data).getTime() : 0;
          return db - da;
        });
    },
    enabled: !!clienteSelecionado,
  });

  // ─── Mutação de baixa ────────────────────────────────────────────────────

  const baixaMutation = useMutation({
    mutationFn: async (payload: { id_pagamento: number; pago_data: string; valor_pago: number; id_conta: number | null }) => {
      const res = await fetch(`/api/pagamentos/${payload.id_pagamento}/baixa`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          pago_data: payload.pago_data,
          valor_pago: payload.valor_pago,
          id_conta: payload.id_conta,
        }),
      });
      if (!res.ok) throw new Error("Erro ao baixar pagamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-pagos"] });
    },
    onError: () => {
      toast({ title: "Erro ao baixar parcela", variant: "destructive" });
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────

  function selecionarCliente(c: ClienteApi) {
    setClienteSelecionado(c);
    setSearchCliente(c.nome);
    setShowSugestoes(false);
    setSelecionados(new Set());
    setFiltroLoteamento("all");
    setFiltroLote("all");
  }

  function limparCliente() {
    setClienteSelecionado(null);
    setSearchCliente("");
    setSelecionados(new Set());
    setFiltroLoteamento("all");
    setFiltroLote("all");
  }

  function toggleSelecionado(id: number) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === pagamentosAbertosFiltered.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(pagamentosAbertosFiltered.map((p) => p.id)));
    }
  }

  function handleAbrirBaixa() {
    if (selecionados.size === 0) {
      toast({ title: "Selecione pelo menos uma parcela", variant: "destructive" });
      return;
    }
    setBaixaData(todayStr());
    setBaixaContaId("");
    setBaixaOpen(true);
  }

  async function handleConfirmarBaixa() {
    const pagoIso = toIsoDateFromBR(baixaData);
    if (!pagoIso) {
      toast({ title: "Data inválida", variant: "destructive" });
      return;
    }

    const contaSelecionada = contasBancarias.find((c) => String(c.id_conta) === baixaContaId) ?? null;
    const parcSelecionadas = pagamentosAbertosFiltered.filter((p) => selecionados.has(p.id));

    try {
      for (const parc of parcSelecionadas) {
        const dias = getDiasAtraso(parc.vencimento);
        const { multa, juros, total } = calcularEncargos(parc.valor, dias);
        await baixaMutation.mutateAsync({
          id_pagamento: parc.id,
          pago_data: pagoIso,
          valor_pago: total,
          id_conta: contaSelecionada ? contaSelecionada.id_conta : null,
        });
        // Gera recibo para cada parcela recebida
        gerarReciboParcela(
          parc,
          baixaData,
          total,
          multa,
          juros,
          contaSelecionada?.apelido ?? "",
          empresaInfo ?? null
        );
      }
      setBaixaOpen(false);
      setSelecionados(new Set());
      toast({ title: `${parcSelecionadas.length} parcela(s) recebida(s) com sucesso!` });
    } catch {
      // erro já tratado no onError
    }
  }

  function handleReimprimirRecibo(pag: Pagamento) {
    const dias = pag.pago_data
      ? Math.max(0, Math.floor(
          (parseBrDate(pag.pago_data).getTime() - parseBrDate(pag.vencimento).getTime()) / (1000 * 60 * 60 * 24)
        ))
      : 0;
    const { multa, juros } = calcularEncargos(pag.valor, dias);
    gerarReciboParcela(
      pag,
      pag.pago_data ?? "—",
      pag.valor_pago ?? pag.valor,
      multa,
      juros,
      "",
      empresaInfo ?? null
    );
  }

  // ─── Dados derivados ─────────────────────────────────────────────────────

  // Todos os registros combinados para montar listas únicas de filtro
  const todosRegistros = [...pagamentosAbertos, ...pagamentosPagos];

  const loteamentosUnicos = Array.from(
    new Set(todosRegistros.map((p) => p.loteamento).filter(Boolean))
  ).sort();

  const lotesUnicos = Array.from(
    new Set(
      todosRegistros
        .filter((p) => filtroLoteamento === "all" || p.loteamento === filtroLoteamento)
        .map((p) => p.lote)
        .filter(Boolean)
    )
  ).sort();

  // Aplica filtros nas parcelas ABERTAS
  const pagamentosAbertosFiltered = pagamentosAbertos.filter((p) => {
    const matchLoteamento = filtroLoteamento === "all" || p.loteamento === filtroLoteamento;
    const matchLote = filtroLote === "all" || p.lote === filtroLote;
    return matchLoteamento && matchLote;
  });

  // Aplica filtros nas parcelas PAGAS
  const pagamentosPagosFiltered = pagamentosPagos.filter((p) => {
    const matchLoteamento = filtroLoteamento === "all" || p.loteamento === filtroLoteamento;
    const matchLote = filtroLote === "all" || p.lote === filtroLote;
    return matchLoteamento && matchLote;
  });

  const atrasadas = pagamentosAbertosFiltered.filter((p) => p.situacao === "atrasado");
  const totalAberto = pagamentosAbertosFiltered.reduce((s, p) => s + p.valor, 0);
  const totalAtrasado = atrasadas.reduce((s, p) => s + p.valor, 0);
  const totalPago = pagamentosPagosFiltered.reduce((s, p) => s + (p.valor_pago ?? p.valor), 0);

  const parcSelecionadas = pagamentosAbertosFiltered.filter((p) => selecionados.has(p.id));
  const totalSelecionado = parcSelecionadas.reduce((s, p) => {
    const dias = getDiasAtraso(p.vencimento);
    const { total } = calcularEncargos(p.valor, dias);
    return s + total;
  }, 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">

        {/* Cabeçalho */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recebimento de parcelas por cliente
          </p>
        </div>

        {/* Busca de cliente */}
        <div className="glass-card rounded-lg p-4">
          <div className="relative max-w-md" ref={searchRef}>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Buscar Cliente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite o nome do cliente..."
                value={searchCliente}
                onChange={(e) => {
                  setSearchCliente(e.target.value);
                  setClienteSelecionado(null);
                  setShowSugestoes(true);
                  setSelecionados(new Set());
                }}
                onFocus={() => setShowSugestoes(true)}
                className="pl-9 pr-9"
              />
              {searchCliente && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={limparCliente}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Sugestões */}
            {showSugestoes && !clienteSelecionado && clientes.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {clientes.map((c) => (
                  <button
                    key={c.id_cliente}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 text-left transition-colors"
                    onClick={() => selecionarCliente(c)}
                  >
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{c.nome}</p>
                      {c.cpf && <p className="text-xs text-muted-foreground">CPF: {c.cpf}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {clienteSelecionado && (
            <p className="text-xs text-muted-foreground mt-2">
              Exibindo parcelas de: <span className="font-semibold text-foreground">{clienteSelecionado.nome}</span>
            </p>
          )}
        </div>

        {/* Cards de resumo */}
        {clienteSelecionado && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card rounded-lg p-4 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-muted text-info">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Em Aberto</p>
                <p className="text-lg font-bold">{formatCurrency(totalAberto)}</p>
                <p className="text-xs text-muted-foreground">{pagamentosAbertosFiltered.filter(p => p.situacao === "aberto").length} parcelas</p>
              </div>
            </div>
            <div className="glass-card rounded-lg p-4 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-muted text-warning">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Atrasadas</p>
                <p className="text-lg font-bold">{formatCurrency(totalAtrasado)}</p>
                <p className="text-xs text-muted-foreground">{atrasadas.length} parcelas</p>
              </div>
            </div>
            <div className="glass-card rounded-lg p-4 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-muted text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pago (Total)</p>
                <p className="text-lg font-bold">{formatCurrency(totalPago)}</p>
                <p className="text-xs text-muted-foreground">{pagamentosPagosFiltered.length} parcelas</p>
              </div>
            </div>
          </div>
        )}

        {/* Filtros compartilhados: Loteamento e Lote */}
        {clienteSelecionado && todosRegistros.length > 0 && (
          <div className="glass-card rounded-lg px-5 py-3 flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium">Filtrar por:</span>
            <Select
              value={filtroLoteamento}
              onValueChange={(v) => { setFiltroLoteamento(v); setFiltroLote("all"); setSelecionados(new Set()); }}
            >
              <SelectTrigger className="h-8 w-56 text-sm">
                <SelectValue placeholder="Todos os loteamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os loteamentos</SelectItem>
                {loteamentosUnicos.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filtroLote}
              onValueChange={(v) => { setFiltroLote(v); setSelecionados(new Set()); }}
            >
              <SelectTrigger className="h-8 w-56 text-sm">
                <SelectValue placeholder="Todos os lotes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os lotes</SelectItem>
                {lotesUnicos.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filtroLoteamento !== "all" || filtroLote !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs text-muted-foreground"
                onClick={() => { setFiltroLoteamento("all"); setFiltroLote("all"); setSelecionados(new Set()); }}
              >
                <X className="h-3 w-3" />
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {/* Abas */}
        {clienteSelecionado && (
          <div className="glass-card rounded-lg overflow-hidden">
            {/* Tab headers */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setAba("abertas")}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  aba === "abertas"
                    ? "border-b-2 border-primary text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Em Aberto
                {pagamentosAbertosFiltered.length > 0 && (
                  <span className="ml-2 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                    {pagamentosAbertosFiltered.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setAba("pagas")}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  aba === "pagas"
                    ? "border-b-2 border-primary text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pagas (Histórico)
                {pagamentosPagosFiltered.length > 0 && (
                  <span className="ml-2 bg-success/10 text-success text-xs px-1.5 py-0.5 rounded-full">
                    {pagamentosPagosFiltered.length}
                  </span>
                )}
              </button>
            </div>

            {/* ─── ABA: EM ABERTO ─── */}
            {aba === "abertas" && (
              <div>
                {/* Toolbar de seleção */}
                {pagamentosAbertosFiltered.length > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-primary"
                        checked={selecionados.size === pagamentosAbertosFiltered.length && pagamentosAbertosFiltered.length > 0}
                        onChange={toggleTodos}
                      />
                      <span className="text-sm text-muted-foreground">
                        {selecionados.size > 0
                          ? `${selecionados.size} selecionada(s) — ${formatCurrency(totalSelecionado)}`
                          : "Selecionar todas"}
                      </span>
                    </div>
                    {selecionados.size > 0 && (
                      <Button size="sm" className="gap-2" onClick={handleAbrirBaixa}>
                        <DollarSign className="h-4 w-4" />
                        Receber {selecionados.size} parcela(s)
                      </Button>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-5 py-3 w-10"></th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Loteamento</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcela</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Vencimento</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Valor</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Situação</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Atraso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loadingAbertos ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground text-sm">
                            Carregando parcelas...
                          </td>
                        </tr>
                      ) : pagamentosAbertosFiltered.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground text-sm">
                            Nenhuma parcela encontrada
                          </td>
                        </tr>
                      ) : (
                        pagamentosAbertosFiltered.map((pag) => {
                          const dias = getDiasAtraso(pag.vencimento);
                          const enc = calcularEncargos(pag.valor, dias);
                          const isAtrasada = pag.situacao === "atrasado";
                          const isSel = selecionados.has(pag.id);
                          return (
                            <tr
                              key={pag.id}
                              className={`transition-colors cursor-pointer ${
                                isSel ? "bg-primary/5" : isAtrasada ? "hover:bg-red-500/5" : "hover:bg-muted/30"
                              }`}
                              onClick={() => toggleSelecionado(pag.id)}
                            >
                              <td className="px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 cursor-pointer accent-primary"
                                  checked={isSel}
                                  onChange={() => toggleSelecionado(pag.id)}
                                />
                              </td>
                              <td className="px-5 py-3 text-muted-foreground text-xs">{pag.loteamento || "—"}</td>
                              <td className="px-5 py-3 text-muted-foreground">{pag.lote}</td>
                              <td className="px-5 py-3 text-muted-foreground">
                                {pag.numero_parcela === 0 || pag.tipo === "entrada"
                                  ? "Entrada"
                                  : `${pag.numero_parcela}/${pag.parcelas}`}
                              </td>
                              <td className={`px-5 py-3 font-medium ${isAtrasada ? "text-destructive" : ""}`}>
                                {pag.vencimento}
                              </td>
                              <td className="px-5 py-3 font-medium">
                                {formatCurrency(pag.valor)}
                                {dias > 0 && (
                                  <span className="block text-xs text-destructive">
                                    c/ encargos: {formatCurrency(enc.total)}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                {isAtrasada ? (
                                  <Badge variant="destructive" className="text-xs gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Atrasada
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs gap-1 text-info border-info/40">
                                    <Clock className="h-3 w-3" />
                                    Aberta
                                  </Badge>
                                )}
                              </td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">
                                {dias > 0 ? (
                                  <span className="text-destructive font-medium">{dias} dias</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Rodapé totais */}
                {pagamentosAbertosFiltered.length > 0 && (
                  <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {pagamentosAbertosFiltered.length} parcela(s)
                      {pagamentosAbertos.length !== pagamentosAbertosFiltered.length && ` (de ${pagamentosAbertos.length} no total)`}
                    </span>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-muted-foreground">
                        Total aberto: <span className="font-semibold text-foreground">{formatCurrency(totalAberto)}</span>
                      </span>
                      {atrasadas.length > 0 && (
                        <span className="text-destructive">
                          Atrasado: <span className="font-semibold">{formatCurrency(totalAtrasado)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── ABA: PAGAS ─── */}
            {aba === "pagas" && (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Loteamento</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcela</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Vencimento</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Pago em</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Valor</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Valor Pago</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Situação</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Recibo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loadingPagos ? (
                        <tr>
                          <td colSpan={9} className="px-5 py-8 text-center text-muted-foreground text-sm">
                            Carregando histórico...
                          </td>
                        </tr>
                      ) : pagamentosPagosFiltered.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-5 py-8 text-center text-muted-foreground text-sm">
                            Nenhum pagamento encontrado
                          </td>
                        </tr>
                      ) : (
                        pagamentosPagosFiltered.map((pag) => (
                          <tr key={pag.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-3 text-muted-foreground text-xs">{pag.loteamento || "—"}</td>
                            <td className="px-5 py-3 text-muted-foreground">{pag.lote}</td>
                            <td className="px-5 py-3 text-muted-foreground">
                              {pag.numero_parcela === 0 || pag.tipo === "entrada"
                                ? "Entrada"
                                : `${pag.numero_parcela}/${pag.parcelas}`}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">{pag.vencimento}</td>
                            <td className="px-5 py-3 font-medium">{pag.pago_data ?? "—"}</td>
                            <td className="px-5 py-3">{formatCurrency(pag.valor)}</td>
                            <td className="px-5 py-3 font-medium text-success">
                              {pag.valor_pago != null ? formatCurrency(pag.valor_pago) : "—"}
                            </td>
                            <td className="px-5 py-3">
                              <Badge variant="secondary" className="text-xs gap-1 text-success border-success/30">
                                <CheckCircle2 className="h-3 w-3" />
                                Pago
                              </Badge>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={() => handleReimprimirRecibo(pag)}
                              >
                                <Printer className="h-3.5 w-3.5" />
                                Recibo
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {pagamentosPagosFiltered.length > 0 && (
                  <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {pagamentosPagosFiltered.length} pagamento(s)
                      {pagamentosPagos.length !== pagamentosPagosFiltered.length && ` (de ${pagamentosPagos.length} no total)`}
                    </span>
                    <span className="text-sm">
                      Total recebido:{" "}
                      <span className="font-semibold text-success">{formatCurrency(totalPago)}</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Estado vazio — sem cliente selecionado */}
        {!clienteSelecionado && (
          <div className="glass-card rounded-lg p-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">
              Busque um cliente acima para visualizar suas parcelas
            </p>
          </div>
        )}
      </div>

      {/* ─── Dialog de Recebimento ─── */}
      <Dialog open={baixaOpen} onOpenChange={setBaixaOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receber Parcelas</DialogTitle>
            <DialogDescription>
              Registrar recebimento de {selecionados.size} parcela(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lista de parcelas selecionadas */}
            <div className="glass-card rounded-lg divide-y divide-border max-h-52 overflow-y-auto">
              {parcSelecionadas.map((p) => {
                const dias = getDiasAtraso(p.vencimento);
                const enc = calcularEncargos(p.valor, dias);
                return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <span className="font-medium">
                        {p.numero_parcela === 0 || p.tipo === "entrada"
                          ? "Entrada"
                          : `Parcela ${p.numero_parcela}/${p.parcelas}`}
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs">venc. {p.vencimento}</span>
                      {dias > 0 && (
                        <span className="text-destructive ml-2 text-xs">({dias} dias atraso)</span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(enc.total)}</p>
                      {dias > 0 && (
                        <p className="text-xs text-muted-foreground">original: {formatCurrency(p.valor)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center px-1 font-semibold text-base border-t border-border pt-2">
              <span>Total a Receber</span>
              <span className="text-primary">{formatCurrency(totalSelecionado)}</span>
            </div>

            {/* Campos */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data do Recebimento</Label>
                <Input
                  value={baixaData}
                  onChange={(e) => setBaixaData(e.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Conta Bancária</Label>
                <Select value={baixaContaId} onValueChange={setBaixaContaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancarias.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Nenhuma conta cadastrada
                      </SelectItem>
                    ) : (
                      contasBancarias.map((c) => (
                        <SelectItem key={c.id_conta} value={String(c.id_conta)}>
                          {c.apelido} — {c.titular}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBaixaOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarBaixa}
              disabled={baixaMutation.isPending}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {baixaMutation.isPending ? "Processando..." : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Pagamentos;
