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
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  User,
  X,
  Printer,
  ChevronsUpDown,
  Check,
  TrendingUp,
  FileText,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
  ativo: boolean;
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
  reajustado?: boolean;
  id_venda?: number;
  venda?: {
    id_venda: number;
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
  id_venda?: number;
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
  reajustado?: boolean;
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

interface EmpresaEncargos {
  multa_percentual: number;   // ex: 2 = 2%
  juros_percentual_dia: number; // ex: 0.2 = 0,2%/dia
  carencia_dias: number;
}

const calcularEncargos = (valor: number, diasAtraso: number, config?: EmpresaEncargos) => {
  const multaPerc = (config?.multa_percentual ?? 2) / 100;
  const jurosPercDia = (config?.juros_percentual_dia ?? 0.2) / 100;
  const carencia = config?.carencia_dias ?? 0;
  const diasEfetivos = Math.max(0, diasAtraso - carencia);
  if (diasEfetivos <= 0) return { multa: 0, juros: 0, total: valor };
  const multa = valor * multaPerc;
  const juros = valor * jurosPercDia * diasEfetivos;
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
  const [filtroLoteamentoOpen, setFiltroLoteamentoOpen] = useState(false);
  const [filtroLote, setFiltroLote] = useState("all");

  // ── Seleção múltipla (aba Abertas) ──
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  // ── Dialog de baixa ──
  const [baixaOpen, setBaixaOpen] = useState(false);
  const [baixaData, setBaixaData] = useState(todayStr());
  const [baixaDispensarMulta, setBaixaDispensarMulta] = useState(false);
  const [baixaDispensarJuros, setBaixaDispensarJuros] = useState(false);
  const [baixaDesconto, setBaixaDesconto] = useState("");
  const [baixaContaId, setBaixaContaId] = useState("");

  // ── Dialog de recibo (reimprimir do histórico) ──
  const [reciboDialogOpen, setReciboDialogOpen] = useState(false);
  const [pagamentoParaRecibo, setPagamentoParaRecibo] = useState<Pagamento | null>(null);

  // ── Confirmação de exclusão em lote ──
  const [confirmarExcluirTodos, setConfirmarExcluirTodos] = useState(false);

  // ── Dialog de reajuste anual ──
  const [reajusteOpen, setReajusteOpen] = useState(false);
  const [reajustePercentual, setReajustePercentual] = useState("5");
  const [reajusteConfirmado, setReajusteConfirmado] = useState(false);
  const [reajusteDe, setReajusteDe] = useState<number>(1);
  const [reajusteAte, setReajusteAte] = useState<number>(9999);
  const [reajusteAplicado, setReajusteAplicado] = useState(false);
  const [reajusteSuccessRange, setReajusteSuccessRange] = useState<{ de: number; ate: number; total: number; percentual: string } | null>(null);

  // ── Impressão de carnê geral ──
  const [carneOpen, setCarneOpen] = useState(false);
  const [carneDe, setCarneDe] = useState<number>(1);
  const [carneAte, setCarneAte] = useState<number>(9999);

  // ── Estorno de pagamento ──
  const [estornoConfirm, setEstornoConfirm] = useState<Pagamento | null>(null);

  // ─── Busca de clientes (autocomplete) ────────────────────────────────────

  // Detecta se é busca por número de carnê (somente dígitos, ≥ 4 chars)
  const isCarneBusca = /^\d+$/.test(searchCliente.trim()) && searchCliente.trim().length >= 4;

  // Extrai id_venda do número de documento do carnê
  // Formato: {venda_id padded 6}{parcela padded 2} → ex: "00157801" → venda 1578
  const idVendaBusca = isCarneBusca
    ? (() => {
        const s = searchCliente.trim();
        // se 8 dígitos → remove os 2 últimos (numero parcela)
        const part = s.length >= 8 ? s.slice(0, s.length - 2) : s;
        return parseInt(part, 10) || null;
      })()
    : null;

  const { data: clienteDoCarneRaw } = useQuery<ClienteApi | null>({
    queryKey: ["venda-carne-busca", idVendaBusca],
    queryFn: async () => {
      if (!idVendaBusca) return null;
      const res = await fetch(`/api/vendas/${idVendaBusca}`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const venda = await res.json();
      if (!venda?.cliente) return null;
      return {
        id_cliente: venda.cliente.id_cliente,
        nome: venda.cliente.nome,
        cpf: venda.cliente.cpf ?? null,
      } as ClienteApi;
    },
    enabled: isCarneBusca && !clienteSelecionado && !!idVendaBusca,
  });
  const clienteDoCarne = clienteDoCarneRaw ?? null;

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
    enabled: !isCarneBusca && searchCliente.trim().length >= 2 && !clienteSelecionado,
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

  const { data: contasBancariasAll = [] } = useQuery<ContaApi[]>({
    queryKey: ["contas-bancarias"],
    queryFn: async () => {
      const res = await fetch("/api/contas", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json() as Promise<ContaApi[]>;
    },
  });
  // Apenas contas ativas são exibidas no dropdown de baixa
  const contasBancarias = contasBancariasAll.filter((c) => c.ativo);

  // ─── Query: Dados da Empresa ─────────────────────────────────────────────

  const { data: empresaInfo } = useQuery<ReciboEmpresa & { multa_percentual?: string; juros_percentual_dia?: string; carencia_dias?: number } | null>({
    queryKey: ["empresa-info"],
    queryFn: async () => {
      const res = await fetch("/api/empresas/minha", { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const encargosConfig: EmpresaEncargos = {
    multa_percentual: empresaInfo?.multa_percentual ? Number(empresaInfo.multa_percentual) : 2,
    juros_percentual_dia: empresaInfo?.juros_percentual_dia ? Number(empresaInfo.juros_percentual_dia) : 0.2,
    carencia_dias: empresaInfo?.carencia_dias ?? 0,
  };

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
            id_venda: p.id_venda ?? p.venda?.id_venda,
            cliente: p.venda?.cliente?.nome ?? "",
            lote: p.venda?.lote ? `Quadra ${p.venda.lote.quadra} - Lote ${p.venda.lote.lote}` : "",
            loteamento: p.venda?.lote?.loteamento?.nome ?? "",
            numero_parcela: p.numero_parcela,
            parcelas: p.venda?.parcelas ?? 0,
            tipo: p.tipo,
            situacao,
            vencimento: formatDateBR(p.vencimento, p.vencimento),
            valor: Number(p.valor),
            reajustado: p.reajustado ?? false,
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
          id_venda: p.id_venda ?? p.venda?.id_venda,
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
          reajustado: p.reajustado ?? false,
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
    mutationFn: async (payload: { id_pagamento: number; pago_data: string; valor_pago: number; id_conta: number | null; multa_override?: number; juros_override?: number; desconto?: number }) => {
      const res = await fetch(`/api/pagamentos/${payload.id_pagamento}/baixa`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          pago_data: payload.pago_data,
          valor_pago: payload.valor_pago,
          id_conta: payload.id_conta,
          multa_override: payload.multa_override,
          juros_override: payload.juros_override,
          desconto: payload.desconto,
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
    setBaixaDispensarMulta(false);
    setBaixaDispensarJuros(false);
    setBaixaDesconto("");
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
    const descontoVal = Math.max(0, parseFloat(baixaDesconto.replace(",", ".")) || 0);

    try {
      for (const parc of parcSelecionadas) {
        const dias = getDiasAtraso(parc.vencimento);
        const enc = calcularEncargos(parc.valor, dias, encargosConfig);
        const multaFinal = baixaDispensarMulta ? 0 : enc.multa;
        const jurosFinal = baixaDispensarJuros ? 0 : enc.juros;
        const totalFinal = Math.max(0, parc.valor + multaFinal + jurosFinal - descontoVal);
        await baixaMutation.mutateAsync({
          id_pagamento: parc.id,
          pago_data: pagoIso,
          valor_pago: totalFinal,
          id_conta: contaSelecionada ? contaSelecionada.id_conta : null,
          multa_override: multaFinal,
          juros_override: jurosFinal,
          desconto: descontoVal,
        });
        // Gera recibo para cada parcela recebida
        gerarReciboParcela(
          parc,
          baixaData,
          totalFinal,
          multaFinal,
          jurosFinal,
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

  const excluirLoteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch("/api/pagamentos/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Erro ao excluir lançamentos");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-pagos"] });
      toast({ title: `${data.deletados} lançamento(s) excluído(s) com sucesso` });
      setConfirmarExcluirTodos(false);
    },
    onError: () => {
      toast({ title: "Erro ao excluir lançamentos", variant: "destructive" });
    },
  });

  const reajusteMutation = useMutation({
    mutationFn: async ({
      id_cliente,
      percentual,
      parcela_de,
      parcela_ate,
    }: {
      id_cliente: number;
      percentual: number;
      parcela_de: number;
      parcela_ate: number;
    }) => {
      const body: Record<string, unknown> = { id_cliente, percentual };
      if (parcela_de > 1) body.parcela_de = parcela_de;
      if (parcela_ate < 9999) body.parcela_ate = parcela_ate;
      const res = await fetch("/api/pagamentos/reajuste", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao aplicar reajuste");
      }
      return res.json() as Promise<{ total_parcelas: number; percentual: number; mensagem: string }>;
    },
    onSuccess: (data) => {
      // Refetch imediato para pegar os novos valores no carnê
      queryClient.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
      queryClient.refetchQueries({ queryKey: ["pagamentos-abertos", clienteSelecionado?.id_cliente] });
      setReajusteConfirmado(false);
      setReajusteAplicado(true);
      setReajusteSuccessRange({ de: reajusteDe, ate: reajusteAte, total: data.total_parcelas, percentual: reajustePercentual });
      setReajustePercentual("5");
      toast({ title: "Reajuste aplicado!", description: data.mensagem });
    },
    onError: (err) => {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao reajustar", variant: "destructive" });
    },
  });

  const estornoMutation = useMutation({
    mutationFn: async (id_pagamento: number) => {
      const res = await fetch(`/api/pagamentos/${id_pagamento}/estornar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao estornar pagamento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-pagos"] });
      setEstornoConfirm(null);
      toast({ title: "Pagamento cancelado", description: "A parcela voltou para Em Aberto." });
    },
    onError: (err) => {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao estornar", variant: "destructive" });
    },
  });

  function handleReimprimirRecibo(pag: Pagamento) {
    const dias = pag.pago_data
      ? Math.max(0, Math.floor(
          (parseBrDate(pag.pago_data).getTime() - parseBrDate(pag.vencimento).getTime()) / (1000 * 60 * 60 * 24)
        ))
      : 0;
    const { multa, juros } = calcularEncargos(pag.valor, dias, encargosConfig);
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

  // ─── Helper: fechar dialog de reajuste e resetar tudo ────────────────────

  function fecharReajusteDialog() {
    setReajusteOpen(false);
    setReajusteConfirmado(false);
    setReajusteAplicado(false);
    setReajustePercentual("5");
    setReajusteDe(1);
    setReajusteAte(9999);
    setReajusteSuccessRange(null);
  }

  // ─── Impressão de carnê (geral e reajustado) ─────────────────────────────

  function imprimirCarne(de: number, ate: number) {
    gerarHTMLCarne(de, ate, false);
    setCarneOpen(false);
  }

  function imprimirCarneReajustado(de: number, ate: number) {
    gerarHTMLCarne(de, ate, true);
  }

  function gerarHTMLCarne(de: number, ate: number, apenasReajustadas: boolean) {
    const parcelasParaImprimir = pagamentosAbertos
      .filter(p => p.tipo !== "entrada" && p.numero_parcela > 0 && p.numero_parcela >= de && p.numero_parcela <= ate)
      .sort((a, b) => a.numero_parcela - b.numero_parcela);

    if (parcelasParaImprimir.length === 0) {
      toast({ title: "Nenhuma parcela no intervalo", variant: "destructive" });
      return;
    }

    const nomeCliente = clienteSelecionado?.nome ?? "";
    const emp = empresaInfo;

    // Agrupa por lote (pode haver múltiplos lotes/vendas)
    const byLote = new Map<string, typeof parcelasParaImprimir>();
    for (const p of parcelasParaImprimir) {
      if (!byLote.has(p.lote)) byLote.set(p.lote, []);
      byLote.get(p.lote)!.push(p);
    }

    let allPagesHTML = "";

    for (const [loteKey, loteParcelas] of byLote) {
      const loteamento = loteParcelas[0]?.loteamento ?? "";
      // Calcula o total de parcelas regulares pelo maior numero_parcela
      // (ignora entrada para não contaminar o denominador, ex: 12 parcelas + 1 entrada ≠ 13)
      const todasParcelasLote = pagamentosAbertos.filter(
        p => p.lote === loteKey && p.tipo !== "entrada" && p.numero_parcela > 0
      );
      const totalParcelasLote = todasParcelasLote.length > 0
        ? Math.max(...todasParcelasLote.map(p => p.numero_parcela))
        : (loteParcelas[0]?.parcelas ?? 0);

      for (let i = 0; i < loteParcelas.length; i += 3) {
        const slice = loteParcelas.slice(i, i + 3);
        const carnesHtml = slice.map(p => {
          const valorFmt = formatCurrency(p.valor);
          const parcelaLabel = `${p.numero_parcela}/${totalParcelasLote}`;
          return `<div class="carne-item">
  <div class="carne-top">
    <div class="info-block">
      <div class="lbl">Loteamento</div>
      <div class="val">${loteamento}</div>
      <div class="sub">${loteKey}</div>
    </div>
    <div style="text-align:right;">
      <div class="lbl">Parcela</div>
      <div class="parcela-num">${parcelaLabel}</div>
    </div>
  </div>
  <div class="carne-mid">
    <div class="lbl">Cliente</div>
    <div class="val">${nomeCliente}</div>
  </div>
  <div class="carne-bot">
    <div>
      <div class="lbl">Vencimento</div>
      <div class="val-lg">${p.vencimento}</div>
    </div>
    ${(apenasReajustadas || p.reajustado) ? `<div class="badge-reaj">✓ REAJUSTADO</div>` : `<div></div>`}
    <div style="text-align:right;">
      <div class="lbl">Valor</div>
      <div class="val-valor">${valorFmt}</div>
    </div>
  </div>
</div>`;
        }).join('');
        allPagesHTML += `<div class="page">${carnesHtml}</div>`;
      }
    }

    const empresaHeader = emp
      ? `<div class="emp-header">
          <div class="emp-nome">${emp.nome_fantasia}</div>
          ${emp.cnpj ? `<div class="emp-det">CNPJ: ${emp.cnpj}</div>` : ""}
          ${emp.telefone ? `<div class="emp-det">Tel: ${emp.telefone}</div>` : ""}
        </div>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${apenasReajustadas ? "Carnê Reajustado" : "Carnê"} — ${nomeCliente}</title>
<style>
@page{size:A4 portrait;margin:10mm 12mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;font-size:9pt}
.emp-header{text-align:center;padding-bottom:4px;margin-bottom:6px;border-bottom:2px solid #333}
.emp-nome{font-size:11pt;font-weight:700}
.emp-det{font-size:8pt;color:#555}
.page{width:100%;height:277mm;display:flex;flex-direction:column;gap:5mm;page-break-after:always}
.page:last-child{page-break-after:avoid}
.carne-item{flex:1;border:2px solid #222;border-radius:3px;padding:8px 12px;display:flex;flex-direction:column;justify-content:space-between}
.carne-top{display:flex;justify-content:space-between;align-items:flex-start}
.carne-mid{border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:4px 0}
.carne-bot{display:flex;justify-content:space-between;align-items:flex-end;padding-top:4px}
.lbl{font-size:6.5pt;color:#777;text-transform:uppercase;letter-spacing:.3px;margin-bottom:1px}
.val{font-size:8.5pt;font-weight:600}
.sub{font-size:7.5pt;color:#555}
.val-lg{font-size:10pt;font-weight:700}
.val-valor{font-size:13pt;font-weight:700}
.parcela-num{font-size:14pt;font-weight:700}
.badge-reaj{font-size:7pt;font-weight:700;color:#b45309;background:#fef3c7;padding:2px 6px;border-radius:3px;letter-spacing:.5px;align-self:center}
</style>
</head>
<body>
${empresaHeader}
${allPagesHTML}
<script>
(function(){
  var d=document.createElement('div');
  d.style.cssText='position:absolute;left:-9999px;width:1mm;height:1mm';
  document.body.appendChild(d);
  var px1mm=d.getBoundingClientRect().height;
  document.body.removeChild(d);
  document.querySelectorAll('.page').forEach(function(pg){
    var its=pg.querySelectorAll('.carne-item');
    var gaps=(its.length-1)*5*px1mm;
    var h=Math.floor((277*px1mm-gaps)/its.length);
    its.forEach(function(it){it.style.height=h+'px';it.style.flex='none';});
  });
  window.print();
})();
</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast({ title: "Popup bloqueado", description: "Permita popups para imprimir", variant: "destructive" });
      return;
    }
    win.document.write(html);
    win.document.close();
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

  // ── Cálculos para o reajuste por ano ──
  const parcelasAbertasSemEntrada = pagamentosAbertos.filter(
    (p) => p.tipo !== "entrada" && p.numero_parcela > 0
  );
  const maxNumeroParcela = parcelasAbertasSemEntrada.reduce(
    (mx, p) => Math.max(mx, p.numero_parcela), 0
  );
  const totalAnosDisponiveis = Math.ceil(maxNumeroParcela / 12) || 1;
  const anosDisponiveis = Array.from({ length: totalAnosDisponiveis }, (_, i) => {
    const ano = i + 1;
    const de = (ano - 1) * 12 + 1;
    const ate = ano * 12;
    const count = parcelasAbertasSemEntrada.filter(
      (p) => p.numero_parcela >= de && p.numero_parcela <= ate
    ).length;
    return { ano, de, ate, count };
  }).filter((a) => a.count > 0);

  const parcelasNoReajusteRange = parcelasAbertasSemEntrada.filter(
    (p) => p.numero_parcela >= reajusteDe && p.numero_parcela <= reajusteAte
  );
  const parcelasNoCarneRange = parcelasAbertasSemEntrada.filter(
    (p) => p.numero_parcela >= carneDe && p.numero_parcela <= carneAte
  );
  const totalNoReajusteRange = parcelasNoReajusteRange.reduce((s, p) => s + p.valor, 0);
  const totalAberto = pagamentosAbertosFiltered.reduce((s, p) => s + p.valor, 0);
  const totalAtrasado = atrasadas.reduce((s, p) => s + p.valor, 0);
  const totalPago = pagamentosPagosFiltered.reduce((s, p) => s + (p.valor_pago ?? p.valor), 0);

  const parcSelecionadas = pagamentosAbertosFiltered.filter((p) => selecionados.has(p.id));
  const totalSelecionado = parcSelecionadas.reduce((s, p) => {
    const dias = getDiasAtraso(p.vencimento);
    const { total } = calcularEncargos(p.valor, dias, encargosConfig);
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
                placeholder="Nome do cliente ou nº do carnê..."
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

            {/* Sugestões — busca por nome */}
            {showSugestoes && !clienteSelecionado && !isCarneBusca && clientes.length > 0 && (
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

            {/* Sugestões — busca por número de carnê */}
            {showSugestoes && !clienteSelecionado && isCarneBusca && (
              <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {clienteDoCarne ? (
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 text-left transition-colors"
                    onClick={() => selecionarCliente(clienteDoCarne)}
                  >
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{clienteDoCarne.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Venda #{idVendaBusca} · {clienteDoCarne.cpf ? `CPF: ${clienteDoCarne.cpf}` : ""}
                      </p>
                    </div>
                  </button>
                ) : idVendaBusca ? (
                  <div className="px-4 py-3 text-xs text-muted-foreground">
                    Nenhuma venda encontrada para o nº {searchCliente.trim()}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {clienteSelecionado && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                Exibindo parcelas de: <span className="font-semibold text-foreground">{clienteSelecionado.nome}</span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => { setCarneDe(1); setCarneAte(9999); setCarneOpen(true); }}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Carnê
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => setConfirmarExcluirTodos(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir Lançamentos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-amber-700 border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  onClick={() => { setReajusteConfirmado(false); setReajusteAplicado(false); setReajusteSuccessRange(null); setReajusteOpen(true); }}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Reajuste Anual
                </Button>
              </div>
            </div>
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
            <Popover open={filtroLoteamentoOpen} onOpenChange={setFiltroLoteamentoOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={cn("h-8 w-56 text-sm justify-between font-normal", filtroLoteamento === "all" && "text-muted-foreground")}
                >
                  <span className="truncate">{filtroLoteamento === "all" ? "Todos os loteamentos" : filtroLoteamento}</span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar loteamento..." />
                  <CommandList>
                    <CommandEmpty>Nenhum loteamento encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => { setFiltroLoteamento("all"); setFiltroLote("all"); setSelecionados(new Set()); setFiltroLoteamentoOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", filtroLoteamento === "all" ? "opacity-100" : "opacity-0")} />
                        Todos os loteamentos
                      </CommandItem>
                      {loteamentosUnicos.map((l) => (
                        <CommandItem key={l} value={l} onSelect={() => { setFiltroLoteamento(l); setFiltroLote("all"); setSelecionados(new Set()); setFiltroLoteamentoOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", filtroLoteamento === l ? "opacity-100" : "opacity-0")} />
                          {l}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

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
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Venda</th>
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
                          const enc = calcularEncargos(pag.valor, dias, encargosConfig);
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
                              <td className="px-3 py-3 text-muted-foreground text-xs font-mono whitespace-nowrap">
                                {pag.id_venda ? `#${pag.id_venda}` : "—"}
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
                                <div className="flex items-center gap-1.5">
                                  {formatCurrency(pag.valor)}
                                  {pag.reajustado && (
                                    <span
                                      title="Parcela reajustada"
                                      className="inline-flex items-center gap-0.5 text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded text-xs font-semibold"
                                    >
                                      <TrendingUp className="h-3 w-3" />
                                      Reaj.
                                    </span>
                                  )}
                                </div>
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
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Venda</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Loteamento</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcela</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Vencimento</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Pago em</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Valor</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Valor Pago</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Situação</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
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
                            <td className="px-3 py-3 text-muted-foreground text-xs font-mono whitespace-nowrap">
                              {pag.id_venda ? `#${pag.id_venda}` : "—"}
                            </td>
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
                            <td className="px-3 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1.5 text-xs"
                                  onClick={() => handleReimprimirRecibo(pag)}
                                  title="Imprimir recibo"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  Recibo
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setEstornoConfirm(pag)}
                                  title="Cancelar pagamento"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
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

      {/* ─── AlertDialog de confirmação de exclusão em lote ─── */}
      <AlertDialog open={confirmarExcluirTodos} onOpenChange={setConfirmarExcluirTodos}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Excluir todos os lançamentos
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Esta ação irá excluir <strong>todos</strong> os lançamentos (abertos e pagos) de{" "}
                <strong>{clienteSelecionado?.nome}</strong> permanentemente.
              </span>
              <span className="block text-destructive font-medium">
                Esta operação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const todosIds = [
                  ...pagamentosAbertos.map((p) => p.id),
                  ...pagamentosPagos.map((p) => p.id),
                ];
                if (todosIds.length > 0) excluirLoteMutation.mutate(todosIds);
              }}
              disabled={excluirLoteMutation.isPending}
            >
              {excluirLoteMutation.isPending ? "Excluindo..." : "Sim, excluir tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Dialog de Reajuste Anual ─── */}
      {/* ─── AlertDialog de confirmação de estorno ─── */}
      <AlertDialog open={!!estornoConfirm} onOpenChange={(o) => { if (!o) setEstornoConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" />
              Cancelar Pagamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Tem certeza que deseja cancelar este pagamento?
              </span>
              {estornoConfirm && (
                <span className="block bg-muted rounded-md p-3 text-sm text-foreground">
                  <strong>{estornoConfirm.lote}</strong> — Parcela{" "}
                  {estornoConfirm.numero_parcela === 0 || estornoConfirm.tipo === "entrada"
                    ? "Entrada"
                    : `${estornoConfirm.numero_parcela}/${estornoConfirm.parcelas}`}
                  {" "}· Pago em {estornoConfirm.pago_data ?? "—"} · Valor{" "}
                  {estornoConfirm.valor_pago != null ? formatCurrency(estornoConfirm.valor_pago) : formatCurrency(estornoConfirm.valor)}
                </span>
              )}
              <span className="block text-destructive font-medium">
                A parcela voltará para "Em Aberto" e o valor pago será apagado.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={estornoMutation.isPending}>Não, manter</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={estornoMutation.isPending}
              onClick={() => { if (estornoConfirm) estornoMutation.mutate(estornoConfirm.id); }}
            >
              {estornoMutation.isPending ? "Cancelando..." : "Sim, cancelar pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Dialog: Imprimir Carnê ─── */}
      <Dialog open={carneOpen} onOpenChange={(o) => { if (!o) setCarneOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Imprimir Carnê
            </DialogTitle>
            <DialogDescription>
              Selecione o intervalo de parcelas em aberto para impressão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Cliente */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-semibold text-sm">{clienteSelecionado?.nome}</p>
              </div>
            </div>
            {/* Intervalo por ano */}
            <div>
              <Label className="text-sm font-medium">Intervalo de parcelas</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Selecione o ano do carnê ou defina um intervalo manual</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  size="sm" type="button"
                  variant={carneDe === 1 && carneAte === 9999 ? "default" : "outline"}
                  onClick={() => { setCarneDe(1); setCarneAte(9999); }}
                >
                  Todos ({parcelasAbertasSemEntrada.length})
                </Button>
                {anosDisponiveis.map(({ ano, de, ate, count }) => (
                  <Button
                    key={ano} size="sm" type="button"
                    variant={carneDe === de && carneAte === ate ? "default" : "outline"}
                    onClick={() => { setCarneDe(de); setCarneAte(ate); }}
                  >
                    Ano {ano} ({count})
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Da parcela</Label>
                  <Input type="number" min={1} value={carneDe} onChange={(e) => setCarneDe(Number(e.target.value) || 1)} className="mt-1 h-8" />
                </div>
                <span className="text-muted-foreground mt-5">até</span>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">(vazio = sem limite)</Label>
                  <Input type="number" min={1} value={carneAte >= 9999 ? "" : carneAte} onChange={(e) => setCarneAte(e.target.value ? Number(e.target.value) : 9999)} className="mt-1 h-8" />
                </div>
              </div>
            </div>
            {/* Prévia */}
            <div className="rounded-lg bg-muted/40 border p-3 space-y-1.5 text-sm">
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Prévia</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {carneDe === 1 && carneAte === 9999 ? "Todas as parcelas" : carneAte === 9999 ? `Parcela ${carneDe} em diante` : `Parcelas ${carneDe} a ${carneAte}`}
                </span>
                <span className="font-medium">{parcelasNoCarneRange.length} parcelas</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCarneOpen(false)}>Cancelar</Button>
            <Button
              className="gap-2"
              onClick={() => imprimirCarne(carneDe, carneAte)}
              disabled={parcelasNoCarneRange.length === 0}
            >
              <Printer className="h-4 w-4" />
              Imprimir ({parcelasNoCarneRange.length} parcelas)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reajusteOpen} onOpenChange={(o) => { if (!reajusteMutation.isPending) { if (!o) fecharReajusteDialog(); } }}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              Reajuste Anual de Parcelas
            </DialogTitle>
            <DialogDescription>
              Aplica um percentual de reajuste nas parcelas <strong>em aberto</strong> do intervalo selecionado.
            </DialogDescription>
          </DialogHeader>

          {/* ── Estado de sucesso ── */}
          {reajusteAplicado && reajusteSuccessRange ? (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300 text-base">Reajuste aplicado com sucesso!</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    {reajusteSuccessRange.total} parcela(s) reajustadas
                    {reajusteSuccessRange.ate < 9999
                      ? ` (parcelas ${reajusteSuccessRange.de} a ${reajusteSuccessRange.ate})`
                      : reajusteSuccessRange.de > 1
                        ? ` (a partir da parcela ${reajusteSuccessRange.de})`
                        : " (todas as parcelas em aberto)"}
                    {" "}em <strong>+{reajusteSuccessRange.percentual}%</strong>.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Os valores já foram atualizados na listagem. Imprima o carnê com os valores reajustados.
              </p>
              <DialogFooter className="gap-2 flex-col sm:flex-row">
                <Button variant="outline" onClick={fecharReajusteDialog} className="flex-1">
                  Fechar
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700 gap-2"
                  onClick={() => imprimirCarneReajustado(reajusteSuccessRange.de, reajusteSuccessRange.ate)}
                >
                  <FileText className="h-4 w-4" />
                  Imprimir Carnê Reajustado
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                {/* Cliente */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-semibold text-sm">{clienteSelecionado?.nome}</p>
                  </div>
                </div>

                {/* Intervalo de parcelas por ano */}
                <div>
                  <Label className="text-sm font-medium">Intervalo de parcelas</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Selecione o ano do carnê ou defina um intervalo manual
                  </p>
                  {/* Botões de atalho por ano */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Button
                      type="button"
                      size="sm"
                      variant={reajusteDe === 1 && reajusteAte === 9999 ? "default" : "outline"}
                      className="text-xs h-7 px-3"
                      onClick={() => { setReajusteDe(1); setReajusteAte(9999); setReajusteConfirmado(false); }}
                    >
                      Todos ({parcelasAbertasSemEntrada.length})
                    </Button>
                    {anosDisponiveis.map(({ ano, de, ate, count }) => (
                      <Button
                        key={ano}
                        type="button"
                        size="sm"
                        variant={reajusteDe === de && reajusteAte === ate ? "default" : "outline"}
                        className={cn(
                          "text-xs h-7 px-3",
                          reajusteDe === de && reajusteAte === ate
                            ? "bg-amber-600 hover:bg-amber-700 border-amber-600"
                            : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        )}
                        onClick={() => { setReajusteDe(de); setReajusteAte(ate); setReajusteConfirmado(false); }}
                      >
                        Ano {ano} ({count})
                      </Button>
                    ))}
                  </div>
                  {/* Inputs manuais */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Da parcela</Label>
                      <Input
                        type="number"
                        min="1"
                        max="9999"
                        value={reajusteDe}
                        onChange={(e) => { setReajusteDe(Math.max(1, Number(e.target.value))); setReajusteConfirmado(false); }}
                        className="w-20 h-7 text-xs"
                      />
                    </div>
                    <span className="text-muted-foreground text-xs">até</span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="1"
                        max="9999"
                        value={reajusteAte >= 9999 ? "" : reajusteAte}
                        placeholder="fim"
                        onChange={(e) => { setReajusteAte(e.target.value ? Number(e.target.value) : 9999); setReajusteConfirmado(false); }}
                        className="w-20 h-7 text-xs"
                      />
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">(vazio = sem limite)</Label>
                    </div>
                  </div>
                </div>

                {/* Percentual */}
                <div>
                  <Label htmlFor="reajuste-pct" className="text-sm font-medium">
                    Percentual de Reajuste (%)
                  </Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Input
                      id="reajuste-pct"
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={reajustePercentual}
                      onChange={(e) => { setReajustePercentual(e.target.value); setReajusteConfirmado(false); }}
                      className="w-28"
                      placeholder="5.00"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <div className="flex gap-1 ml-auto">
                      {[5, 7, 10, 15].map((v) => (
                        <Button key={v} type="button" variant="outline" size="sm" className="text-xs h-7 px-2"
                          onClick={() => { setReajustePercentual(String(v)); setReajusteConfirmado(false); }}>
                          {v}%
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {Number(reajustePercentual) > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 space-y-1.5 text-sm">
                    <p className="font-semibold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wide">Prévia do reajuste</p>
                    <div className="flex justify-between text-amber-700 dark:text-amber-400">
                      <span>
                        Intervalo:{" "}
                        {reajusteDe === 1 && reajusteAte === 9999
                          ? "todas as parcelas"
                          : reajusteAte === 9999
                          ? `parcela ${reajusteDe} em diante`
                          : `parcelas ${reajusteDe} a ${reajusteAte}`}
                      </span>
                      <span className="font-medium">{parcelasNoReajusteRange.length} parcelas</span>
                    </div>
                    <div className="flex justify-between text-amber-700 dark:text-amber-400">
                      <span>Reajuste</span>
                      <span className="font-medium">+{reajustePercentual}%</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-200 dark:border-amber-700 pt-1.5">
                      <span className="font-semibold text-amber-800 dark:text-amber-300">Total no intervalo após reajuste</span>
                      <span className="font-bold text-amber-800 dark:text-amber-300">
                        {formatCurrency(totalNoReajusteRange * (1 + Number(reajustePercentual) / 100))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Aviso / Confirmação */}
                {!reajusteConfirmado ? (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Esta ação <strong>não pode ser desfeita</strong>. Os valores das parcelas selecionadas serão alterados permanentemente.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 text-xs text-green-800 dark:text-green-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Confirmado. Clique em <strong>Aplicar Reajuste</strong> para prosseguir.</span>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="gap-2 mr-auto"
                  onClick={() => imprimirCarne(reajusteDe, reajusteAte)}
                  disabled={parcelasNoReajusteRange.length === 0}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Carnê
                </Button>
                <Button variant="outline" onClick={fecharReajusteDialog} disabled={reajusteMutation.isPending}>
                  Cancelar
                </Button>
                {!reajusteConfirmado ? (
                  <Button
                    variant="destructive"
                    onClick={() => setReajusteConfirmado(true)}
                    disabled={
                      !Number(reajustePercentual) ||
                      Number(reajustePercentual) <= 0 ||
                      parcelasNoReajusteRange.length === 0
                    }
                  >
                    Confirmar Reajuste
                    {parcelasNoReajusteRange.length > 0 && ` (${parcelasNoReajusteRange.length} parcelas)`}
                  </Button>
                ) : (
                  <Button
                    className="bg-amber-600 hover:bg-amber-700 gap-2"
                    onClick={() => {
                      if (!clienteSelecionado) return;
                      reajusteMutation.mutate({
                        id_cliente: clienteSelecionado.id_cliente,
                        percentual: Number(reajustePercentual),
                        parcela_de: reajusteDe,
                        parcela_ate: reajusteAte,
                      });
                    }}
                    disabled={reajusteMutation.isPending}
                  >
                    {reajusteMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Aplicando...</>
                    ) : (
                      <><TrendingUp className="h-4 w-4" /> Aplicar Reajuste</>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Dialog de Recebimento ─── */}
      <Dialog open={baixaOpen} onOpenChange={setBaixaOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receber Parcelas</DialogTitle>
            <DialogDescription>
              Registrar recebimento de {selecionados.size} parcela(s)
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const descontoVal = Math.max(0, parseFloat(baixaDesconto.replace(",", ".")) || 0);
            const totalBaixa = parcSelecionadas.reduce((acc, p) => {
              const dias = getDiasAtraso(p.vencimento);
              const enc = calcularEncargos(p.valor, dias, encargosConfig);
              const multaF = baixaDispensarMulta ? 0 : enc.multa;
              const jurosF = baixaDispensarJuros ? 0 : enc.juros;
              return acc + p.valor + multaF + jurosF;
            }, 0);
            const totalFinal = Math.max(0, totalBaixa - descontoVal);
            const temAtraso = parcSelecionadas.some(p => getDiasAtraso(p.vencimento) > encargosConfig.carencia_dias);

            return (
              <div className="space-y-4">
                {/* Lista de parcelas */}
                <div className="glass-card rounded-lg divide-y divide-border max-h-44 overflow-y-auto">
                  {parcSelecionadas.map((p) => {
                    const dias = getDiasAtraso(p.vencimento);
                    const enc = calcularEncargos(p.valor, dias, encargosConfig);
                    const multaF = baixaDispensarMulta ? 0 : enc.multa;
                    const jurosF = baixaDispensarJuros ? 0 : enc.juros;
                    const subtotal = p.valor + multaF + jurosF;
                    return (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <div>
                          <span className="font-medium">
                            {p.numero_parcela === 0 || p.tipo === "entrada" ? "Entrada" : `Parcela ${p.numero_parcela}/${p.parcelas}`}
                          </span>
                          <span className="text-muted-foreground ml-2 text-xs">venc. {p.vencimento}</span>
                          {dias > encargosConfig.carencia_dias && (
                            <span className="text-destructive ml-2 text-xs">({dias} dias atraso)</span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(subtotal)}</p>
                          {enc.multa > 0 || enc.juros > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(p.valor)}
                              {enc.multa > 0 && !baixaDispensarMulta && ` + M:${formatCurrency(enc.multa)}`}
                              {enc.juros > 0 && !baixaDispensarJuros && ` + J:${formatCurrency(enc.juros)}`}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Encargos — só mostra se houver atraso */}
                {temAtraso && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Encargos por Atraso</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="disp-multa" checked={baixaDispensarMulta}
                          onChange={(e) => setBaixaDispensarMulta(e.target.checked)}
                          className="rounded" />
                        <Label htmlFor="disp-multa" className="text-sm cursor-pointer">
                          Dispensar Multa ({encargosConfig.multa_percentual}%)
                        </Label>
                      </div>
                      <span className={`text-xs ${baixaDispensarMulta ? "line-through text-muted-foreground" : "text-destructive font-medium"}`}>
                        {formatCurrency(parcSelecionadas.reduce((a, p) => {
                          const dias = getDiasAtraso(p.vencimento);
                          return a + calcularEncargos(p.valor, dias, encargosConfig).multa;
                        }, 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="disp-juros" checked={baixaDispensarJuros}
                          onChange={(e) => setBaixaDispensarJuros(e.target.checked)}
                          className="rounded" />
                        <Label htmlFor="disp-juros" className="text-sm cursor-pointer">
                          Dispensar Juros ({encargosConfig.juros_percentual_dia}%/dia)
                        </Label>
                      </div>
                      <span className={`text-xs ${baixaDispensarJuros ? "line-through text-muted-foreground" : "text-destructive font-medium"}`}>
                        {formatCurrency(parcSelecionadas.reduce((a, p) => {
                          const dias = getDiasAtraso(p.vencimento);
                          return a + calcularEncargos(p.valor, dias, encargosConfig).juros;
                        }, 0))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Desconto */}
                <div className="flex items-center gap-3">
                  <Label className="text-xs whitespace-nowrap">Desconto (R$)</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={baixaDesconto}
                    onChange={(e) => setBaixaDesconto(e.target.value)}
                    placeholder="0,00"
                    className="h-8"
                  />
                </div>

                {/* Total */}
                <div className="flex justify-between items-center px-1 font-bold text-base border-t border-border pt-2">
                  <span>Total a Receber</span>
                  <span className="text-primary">{formatCurrency(totalFinal)}</span>
                </div>

                {/* Campos */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data do Recebimento</Label>
                    <Input value={baixaData} onChange={(e) => setBaixaData(e.target.value)} placeholder="dd/mm/aaaa" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Conta Bancária</Label>
                    <Select value={baixaContaId} onValueChange={setBaixaContaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Conta (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {contasBancarias.length === 0 ? (
                          <SelectItem value="__none" disabled>Nenhuma conta</SelectItem>
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
            );
          })()}

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
