import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateBR } from "@/lib/date-br";
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
  History,
  Grid3X3,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { gerarReciboParcela, ReciboEmpresa } from "@/utils/reciboParcela";
import { ContratoDialog } from "@/components/contratos/ContratoDialog";
import { NovoClienteDialog, NovoClienteFormValues } from "@/components/clientes/NovoClienteDialog";
import { NovoLoteDialog } from "@/components/lotes/NovoLoteDialog";
import { LoteamentoCombobox } from "@/components/ui/loteamento-combobox";
import { FileText, Pencil, FileCheck, Receipt, FileSignature, ArrowRightLeft } from "lucide-react";

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
  valor_parcela?: number;
  status: VendaStatus;
  valor_total: number;
}

interface Pagamento {
  id_pagamento: number;
  numero_parcela: number;
  tipo?: string;
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
  valor_parcela?: string | null;
  status: VendaStatus;
  pagamentos: Pagamento[];
  cliente?: { nome: string };
  lote?: { quadra: number; lote: number; area?: string; loteamento?: { nome: string; cidade?: string; estado?: string } };
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
  return formatDateBR(d, "—");
};

const statusConfig: Record<VendaStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  aberta: { label: "Aberta", variant: "default" },
  quitada: { label: "Quitada", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

// ─── Historico row type ─────────────────────────────────────────────────────
interface HistoricoParcelaRow {
  numero_parcela: number;
  vencimento: string;
  valor: string;
  situacao: "aberto" | "pago";
  pago_data: string;
  valor_pago: string;
}

// ─── Component ─────────────────────────────────────────────────────────────
const Vendas = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedLoteId = searchParams.get("id_lote");

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
  const [valorEntrada, setValorEntrada] = useState("0");
  const [numParcelas, setNumParcelas] = useState("12");
  const [valorParcelaVenda, setValorParcelaVenda] = useState("");

  // ── success after create
  const [vendaCriada, setVendaCriada] = useState<VendaDetalhe | null>(null);
  const [vendaCriadaCliente, setVendaCriadaCliente] = useState<{ id: number; nome: string } | null>(null);
  const [dialogSucessoAberto, setDialogSucessoAberto] = useState(false);

  // ── contrato dialog
  const [contratoDialogAberto, setContratoDialogAberto] = useState(false);

  // ── editar vencimento de parcela
  const [vencimentoEditando, setVencimentoEditando] = useState<number | null>(null); // id_pagamento
  const [vencimentoEditando_valor, setVencimentoEditando_valor] = useState("");

  // ── editar venda
  const [editarVendaAberto, setEditarVendaAberto] = useState(false);
  const [editDataVenda, setEditDataVenda] = useState("");
  const [editEntrada, setEditEntrada] = useState("0");
  const [editParcelas, setEditParcelas] = useState("12");
  const [editValorParcela, setEditValorParcela] = useState("0");

  // ── detail / baixa
  const [vendaDetalhe, setVendaDetalhe] = useState<VendaDetalhe | null>(null);
  const [vendaDetalheInfo, setVendaDetalheInfo] = useState<VendaListItem | null>(null);
  const [dialogDetalheAberto, setDialogDetalheAberto] = useState(false);
  const [parcelaParaBaixa, setParcelaParaBaixa] = useState<Pagamento | null>(null);
  const [dialogBaixaAberto, setDialogBaixaAberto] = useState(false);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaValor, setBaixaValor] = useState("");
  const [baixaConta, setBaixaConta] = useState("");

  // ── seleção de intervalo de parcelas para impressão do carnê
  const [carneRangeAberto, setCarneRangeAberto] = useState(false);
  const [carneModo, setCarneModo] = useState<"venda" | "detalhe">("venda");
  const [carneTotalParcelas, setCarneTotalParcelas] = useState(0);
  const [carneDe, setCarneDe] = useState(1);
  const [carneAte, setCarneAte] = useState(12);

  // ── cadastro rápido de cliente (no step 2)
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);

  // ── cadastro rápido de lote (no step 1)
  const [novoLoteAberto, setNovoLoteAberto] = useState(false);

  // ── cancelar
  const [confirmarCancelamento, setConfirmarCancelamento] = useState<VendaListItem | null>(null);
  const [bloqueadoPorPagamentos, setBloqueadoPorPagamentos] = useState<{ venda: VendaListItem; id_cliente: number } | null>(null);

  // ── lote ja vendido
  const [loteJaVendido, setLoteJaVendido] = useState<{ id_venda: number; id_cliente: number } | null>(null);

  // ── historico dialog
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historicoStep, setHistoricoStep] = useState<1 | 2 | 3 | 4>(1);
  const [histLoteamento, setHistLoteamento] = useState<Loteamento | null>(null);
  const [histLote, setHistLote] = useState<LoteDisponivel | null>(null);
  const [histCliente, setHistCliente] = useState<Cliente | null>(null);
  const [histClienteSearch, setHistClienteSearch] = useState("");
  const [histDataVenda, setHistDataVenda] = useState(new Date().toISOString().split("T")[0]);
  const [histEntrada, setHistEntrada] = useState("0");
  const [histParcelas, setHistParcelas] = useState("12");
  const [histValorParcela, setHistValorParcela] = useState("");
  const [histRows, setHistRows] = useState<HistoricoParcelaRow[]>([]);

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
        valor_parcela: Number(v.valor_parcela ?? 0),
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
    enabled: novaVendaAberto || Boolean(preselectedLoteId),
  });

  const { data: clientes = [], refetch: refetchClientes } = useQuery<Cliente[]>({
    queryKey: ["clientes-venda"],
    queryFn: async () => {
      // Busca todos os clientes em lotes de 1000 para suportar bases grandes
      const all: Cliente[] = [];
      let page = 1;
      while (true) {
        const r = await fetch(`/api/clientes?limit=1000&page=${page}`, { headers: { ...getAuthHeaders() } });
        if (!r.ok) throw new Error();
        const json = await r.json() as { data: Cliente[]; total: number };
        const data = json.data ?? [];
        all.push(...data);
        if (all.length >= json.total || data.length < 1000) break;
        page++;
      }
      return all;
    },
    staleTime: 0,
    retry: 2,
    enabled: novaVendaAberto || historicoAberto,
  });

  // Força refetch ao abrir qualquer dialog que usa clientes
  useEffect(() => {
    if (novaVendaAberto || historicoAberto) {
      refetchClientes();
    }
  }, [novaVendaAberto, historicoAberto]);

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

  const { data: empresaConfig } = useQuery<ReciboEmpresa | null>({
    queryKey: ["minha-empresa"],
    queryFn: async () => {
      const r = await fetch("/api/empresas/minha", { headers: { ...getAuthHeaders() } });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  // ─── Effect para pré-selecionar lote ───────────────────────────────────────
  useEffect(() => {
    if (!preselectedLoteId || todosLotes.length === 0 || novaVendaAberto) return;

    const loteId = Number(preselectedLoteId);
    if (!Number.isFinite(loteId) || loteId <= 0) {
      const next = new URLSearchParams(searchParams);
      next.delete("id_lote");
      setSearchParams(next, { replace: true });
      return;
    }

    const lote = todosLotes.find((l) => l.id_lote === loteId);
    if (!lote) {
      const next = new URLSearchParams(searchParams);
      next.delete("id_lote");
      setSearchParams(next, { replace: true });
      return;
    }

    if (lote.status !== "disponivel") {
      toast({
        title: "Lote indisponível",
        description: "Este lote já está vendido e não pode iniciar uma nova venda.",
        variant: "destructive",
      });
      const next = new URLSearchParams(searchParams);
      next.delete("id_lote");
      setSearchParams(next, { replace: true });
      return;
    }

    setSelectedLote(lote);
    setSelectedLoteamento(loteamentos.find((l) => l.id_loteamento === lote.id_loteamento) || null);
    setNovaVendaAberto(true);
    setStep(2);

    const next = new URLSearchParams(searchParams);
    next.delete("id_lote");
    setSearchParams(next, { replace: true });
  }, [preselectedLoteId, searchParams, setSearchParams, todosLotes, loteamentos, novaVendaAberto]);

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
        valor_parcela: Number(valorParcelaVenda),
      };
      const r = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      let data: unknown;
      try { data = await r.json(); } catch { data = null; }
      if (!r.ok) {
        const errData = data as { error?: string; status?: number; venda_existente?: { id_venda: number; id_cliente: number } } | null;
        throw { status: r.status, ...errData };
      }
      return data as VendaDetalhe;
    },
    onSuccess: (venda) => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      setNovaVendaAberto(false);
      setVendaCriada(venda);
      if (selectedCliente) setVendaCriadaCliente({ id: selectedCliente.id_cliente, nome: selectedCliente.nome });
      setDialogSucessoAberto(true);

      // Gerar recibo da entrada automaticamente (parcela 0)
      const entradaValor = Number(venda.valor_entrada);
      if (entradaValor > 0 && selectedCliente) {
        const entradaParcela = venda.pagamentos?.find((p) => p.numero_parcela === 0);
        const loteLabel = venda.lote
          ? `Quadra ${venda.lote.quadra} Lote ${venda.lote.lote}`
          : `Lote #${venda.id_lote}`;
        const loteamentoLabel = venda.lote?.loteamento?.nome ?? "";
        const dataVendaIso = venda.data_venda ?? dataVenda;
        const [y, m, d] = dataVendaIso.split("-");
        const dataBR = y && m && d ? `${d}/${m}/${y}` : dataVendaIso;

        gerarReciboParcela(
          {
            id: entradaParcela?.id_pagamento ?? 0,
            cliente: selectedCliente.nome,
            lote: loteLabel,
            loteamento: loteamentoLabel,
            numero_parcela: 0,
            parcelas: venda.parcelas,
            tipo: "entrada",
            situacao: "pago",
            vencimento: dataBR,
            valor: entradaValor,
            pago_data: dataBR,
            valor_pago: entradaValor,
          },
          dataBR,
          entradaValor,
          0,
          0,
          "",
          empresaConfig ?? null
        );
      }

      resetNovaVenda();
    },
    onError: (err: unknown) => {
      const errData = err as Record<string, unknown>;

      // Lote já vendido - pergunta se deseja cancelar
      if (errData?.status === 409 && errData?.error === "lote_ja_vendido") {
        setLoteJaVendido(errData.venda_existente as { id_venda: number; id_cliente: number });
        return;
      }

      toast({
        title: "Erro ao registrar venda",
        description: typeof errData?.error === "string"
          ? errData.error
          : errData?.error instanceof Error
            ? errData.error.message
            : "Erro desconhecido",
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
    mutationFn: async (values: NovoClienteFormValues) => {
      const body = {
        tipo: values.tipo,
        nome: values.nome.trim(),
        razao_social: values.razao_social.trim() || undefined,
        cpf: values.cpf.trim() || undefined,
        cnpj: values.cnpj.trim() || undefined,
        rg: values.rg.trim() || undefined,
        estado_civil: values.estado_civil.trim() || undefined,
        conjuge: values.conjuge.trim() || undefined,
        profissao: values.profissao.trim() || undefined,
        endereco: values.endereco.trim() || undefined,
        bairro: values.bairro.trim() || undefined,
        cidade: values.cidade.trim() || undefined,
        estado: values.estado.trim() || undefined,
        cep: values.cep.trim() || undefined,
        complemento: values.complemento.trim() || undefined,
        fone_res: values.fone_res.trim() || undefined,
        fone_com: values.fone_com.trim() || undefined,
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
      // Injeta o novo cliente diretamente no cache — aparece na lista imediatamente
      queryClient.setQueryData<Cliente[]>(["clientes-venda"], (old) => {
        const lista = old ?? [];
        // evita duplicata
        if (lista.some((c) => c.id_cliente === cliente.id_cliente)) return lista;
        return [...lista, cliente].sort((a, b) => a.nome.localeCompare(b.nome));
      });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setSelectedCliente(cliente);
      // Limpa o campo de busca para que o novo cliente apareça destacado
      setClienteSearch("");
      setNovoClienteAberto(false);
      toast({ title: "Cliente cadastrado e selecionado" });
    },
    onError: (err, variables) => {
      const msg = err instanceof Error ? err.message : "Erro";
      // CPF/CNPJ duplicado: tenta encontrar e selecionar o cliente existente na lista
      const isDuplicate = msg.toLowerCase().includes("cpf") || msg.toLowerCase().includes("cnpj") || msg.toLowerCase().includes("cadastrado");
      if (isDuplicate) {
        const cpfDigits = (variables.cpf ?? "").replace(/\D/g, "");
        const cnpjDigits = (variables.cnpj ?? "").replace(/\D/g, "");
        const existente = clientes.find((c) => {
          const cCpf = (c.cpf ?? "").replace(/\D/g, "");
          const cCnpj = (c.cnpj ?? "").replace(/\D/g, "");
          return (cpfDigits && cCpf === cpfDigits) || (cnpjDigits && cCnpj === cnpjDigits);
        });
        if (existente) {
          setSelectedCliente(existente);
          setClienteSearch("");
          setNovoClienteAberto(false);
          toast({ title: "Cliente já cadastrado", description: `${existente.nome} selecionado automaticamente.` });
          return;
        }
        // Cliente existe no banco mas não está no cache ainda — refaz a busca
        refetchClientes().then(({ data }) => {
          const encontrado = (data ?? []).find((c) => {
            const cCpf = (c.cpf ?? "").replace(/\D/g, "");
            const cCnpj = (c.cnpj ?? "").replace(/\D/g, "");
            return (cpfDigits && cCpf === cpfDigits) || (cnpjDigits && cCnpj === cnpjDigits);
          });
          if (encontrado) {
            setSelectedCliente(encontrado);
            setClienteSearch("");
            setNovoClienteAberto(false);
            toast({ title: "Cliente já cadastrado", description: `${encontrado.nome} selecionado automaticamente.` });
            return;
          }
          toast({ title: "Erro", description: msg, variant: "destructive" });
        });
        return;
      }
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const lancarHistoricoMutation = useMutation({
    mutationFn: async () => {
      if (!histLote || !histCliente) throw new Error("Selecione lote e cliente");
      const body = {
        id_cliente: histCliente.id_cliente,
        id_lote: histLote.id_lote,
        data_venda: histDataVenda,
        valor_entrada: Number(histEntrada),
        parcelas: Number(histParcelas),
        valor_parcela: Number(histValorParcela),
        pagamentos: histRows.map((r) => ({
          numero_parcela: r.numero_parcela,
          vencimento: r.vencimento,
          valor: Number(r.valor),
          situacao: r.situacao,
          pago_data: r.situacao === "pago" && r.pago_data ? r.pago_data : null,
          valor_pago: r.situacao === "pago" && r.valor_pago ? Number(r.valor_pago) : null,
        })),
      };
      const r = await fetch("/api/vendas/historico", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      let data: unknown;
      try { data = await r.json(); } catch { data = null; }
      if (!r.ok) {
        const errData = data as { error?: string; venda_existente?: { id_venda: number; id_cliente: number } } | null;
        throw { status: r.status, ...errData };
      }
      return data as VendaDetalhe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      setHistoricoAberto(false);
      resetHistorico();
      toast({ title: "Histórico lançado com sucesso!", description: `${histRows.length} parcelas registradas.` });
    },
    onError: (err: unknown) => {
      const errData = err as Record<string, unknown>;
      if (errData?.status === 409 && errData?.error === "lote_ja_vendido") {
        setLoteJaVendido(errData.venda_existente as { id_venda: number; id_cliente: number });
        return;
      }
      toast({
        title: "Erro ao lançar histórico",
        description: typeof errData?.error === "string" ? errData.error : "Erro desconhecido",
        variant: "destructive",
      });
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

  // ─── Mutation: editar venda ────────────────────────────────────────────────
  const editarVendaMutation = useMutation({
    mutationFn: async () => {
      if (!vendaCriada) throw new Error("Venda não encontrada");
      const body = {
        data_venda: editDataVenda,
        valor_entrada: Number(editEntrada),
        parcelas: Number(editParcelas),
        valor_parcela: Number(editValorParcela),
        porcentagem: 0,
        salario_minimo_base: null,
      };
      const r = await fetch(`/api/vendas/${vendaCriada.id_venda}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Erro ao alterar venda");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      setEditarVendaAberto(false);
      toast({ title: "Venda alterada com sucesso!" });
    },
    onError: (err) => {
      toast({ title: "Erro ao alterar venda", description: err instanceof Error ? err.message : "", variant: "destructive" });
    },
  });

  // ─── Mutation: editar vencimento de parcela ────────────────────────────────
  const editarVencimentoMutation = useMutation({
    mutationFn: async ({ id_pagamento, vencimento }: { id_pagamento: number; vencimento: string }) => {
      const r = await fetch(`/api/pagamentos/${id_pagamento}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ vencimento }),
      });
      if (!r.ok) throw new Error("Erro ao alterar vencimento");
      return r.json();
    },
    onSuccess: (_, vars) => {
      // Atualiza localmente a lista de parcelas sem refetch completo
      setVendaCriada((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pagamentos: prev.pagamentos.map((p) =>
            p.id_pagamento === vars.id_pagamento ? { ...p, vencimento: vars.vencimento } : p
          ),
        };
      });
      setVencimentoEditando(null);
      toast({ title: "Vencimento alterado!" });
    },
    onError: (err) => {
      toast({ title: "Erro ao alterar vencimento", description: err instanceof Error ? err.message : "", variant: "destructive" });
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
    setValorEntrada("0");
    setNumParcelas("12");
    setValorParcelaVenda("");
  }

  function resetHistorico() {
    setHistoricoStep(1);
    setHistLoteamento(null);
    setHistLote(null);
    setHistCliente(null);
    setHistClienteSearch("");
    setHistDataVenda(new Date().toISOString().split("T")[0]);
    setHistEntrada("0");
    setHistParcelas("12");
    setHistValorParcela("");
    setHistRows([]);
  }

  function gerarLinhasHistorico() {
    const n = Number(histParcelas);
    const vp = Number(histValorParcela) || 0;
    const baseDate = new Date(histDataVenda + "T12:00:00");
    const rows: HistoricoParcelaRow[] = [];
    for (let i = 1; i <= n; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      rows.push({
        numero_parcela: i,
        vencimento: d.toISOString().slice(0, 10),
        valor: vp.toFixed(2),
        situacao: "aberto",
        pago_data: "",
        valor_pago: "",
      });
    }
    setHistRows(rows);
    setHistoricoStep(4);
  }

  function updateHistRow(idx: number, field: keyof HistoricoParcelaRow, value: string) {
    setHistRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      if (field === "situacao" && value === "pago" && !updated.valor_pago) {
        updated.valor_pago = r.valor;
        if (!updated.pago_data) updated.pago_data = new Date().toISOString().slice(0, 10);
      }
      return updated;
    }));
  }

  function marcarTodas(situacao: "aberto" | "pago") {
    setHistRows((prev) => prev.map((r) => ({
      ...r,
      situacao,
      valor_pago: situacao === "pago" ? r.valor : "",
      pago_data: situacao === "pago" ? (r.pago_data || new Date().toISOString().slice(0, 10)) : "",
    })));
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

  function abrirCarneRange(modo: "venda" | "detalhe") {
    const total = modo === "venda"
      ? (vendaCriada?.pagamentos?.length ?? 0)
      : (vendaDetalhe?.pagamentos?.length ?? 0);
    setCarneModo(modo);
    setCarneTotalParcelas(total);
    setCarneDe(1);
    setCarneAte(Math.min(12, total));
    setCarneRangeAberto(true);
  }

  function imprimirCarne(de = 1, ate = Infinity) {
    if (!vendaCriada) return;
    const win = window.open("", "", "width=900,height=700");
    if (!win) {
      toast({ title: "Bloqueador de pop-ups ativado", variant: "destructive" });
      return;
    }

    const nomeEmpresa = empresaConfig?.nome_fantasia || "EMPRESA";
    const telefone = empresaConfig?.telefone || "";
    const enderecoEmpresa = [
      empresaConfig?.endereco,
      empresaConfig?.bairro,
      [empresaConfig?.cidade, empresaConfig?.estado].filter(Boolean).join(" - "),
    ].filter(Boolean).join(", ");
    const cnpjEmpresa = empresaConfig?.cnpj || "";

    const clienteNome = vendaCriada.cliente?.nome || "indefinido";
    const quadraNum = vendaCriada.lote?.quadra ?? "";
    const loteNum = vendaCriada.lote?.lote ?? "";
    const loteamentoNome = vendaCriada.lote?.loteamento?.nome || "indefinido";
    const loteamentoCidade = [
      vendaCriada.lote?.loteamento?.cidade,
      vendaCriada.lote?.loteamento?.estado,
    ].filter(Boolean).join(" - ");

    const jurosPct = Number(vendaCriada.porcentagem) || 1;
    const instrucoes = `Após o vencimento cobrar juros de ${jurosPct}% ao mês e multa de 2% sobre o valor da parcela.`;

    const todasParcelas = [...(vendaCriada.pagamentos ?? [])].sort((a, b) => a.numero_parcela - b.numero_parcela);
    const parcelas = todasParcelas.filter((p) => p.numero_parcela >= de && p.numero_parcela <= ate);
    const totalParcelas = todasParcelas.length;

    function buildCarne(p: typeof parcelas[0], via: string): string {
      const docNum = `${String(vendaCriada!.id_venda).padStart(6, "0")}${String(p.numero_parcela).padStart(2, "0")}`;
      return `
        <div class="carne">
          <div class="header">
            <div class="empresa-nome">${nomeEmpresa}</div>
            ${cnpjEmpresa ? `<div class="empresa-sub">CNPJ: ${cnpjEmpresa}</div>` : ""}
            ${enderecoEmpresa ? `<div class="empresa-sub">${enderecoEmpresa}${telefone ? ` · Tel: ${telefone}` : ""}</div>` : ""}
            <div class="via-label">${via}</div>
          </div>

          <div class="field-row">
            <div class="field full">
              <span class="flabel">CLIENTE</span>
              <span class="fvalue">${clienteNome}</span>
            </div>
          </div>

          <div class="field-row grid3">
            <div class="field">
              <span class="flabel">LOTE</span>
              <span class="fvalue">${loteNum} — ${loteamentoNome}</span>
            </div>
            <div class="field">
              <span class="flabel">QUADRA</span>
              <span class="fvalue">${quadraNum}</span>
            </div>
            <div class="field">
              <span class="flabel">PARCELA</span>
              <span class="fvalue bold">${String(p.numero_parcela).padStart(2, "0")} / ${String(totalParcelas).padStart(2, "0")}</span>
            </div>
          </div>

          <div class="field-row grid3">
            <div class="field">
              <span class="flabel">DOCUMENTO</span>
              <span class="fvalue">${docNum}</span>
            </div>
            <div class="field">
              <span class="flabel">VENCIMENTO</span>
              <span class="fvalue">${fmtDate(p.vencimento)}</span>
            </div>
            <div class="field">
              <span class="flabel">VALOR</span>
              <span class="fvalue bold">${fmtCurrency(p.valor)}</span>
            </div>
          </div>

          <div class="field-row">
            <div class="field full">
              <span class="flabel">ENDEREÇO DO LOTEAMENTO</span>
              <span class="fvalue">${loteamentoCidade || loteamentoNome}</span>
            </div>
          </div>

          <div class="instrucoes">${instrucoes}</div>

          <div class="calc-section">
            <div class="calc-row"><span class="calc-label">(+) Juros</span><span class="calc-line"></span></div>
            <div class="calc-row"><span class="calc-label">(+) Multa</span><span class="calc-line"></span></div>
            <div class="calc-row total-row"><span class="calc-label bold">(=) Valor Cobrado</span><span class="calc-line"></span></div>
          </div>

          <div class="barcode-area">
            <div class="barcode">*${docNum}*</div>
            <div class="barcode-num">${docNum}</div>
          </div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Carnê - Venda #${vendaCriada.id_venda}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 10mm; }
          body { font-family: Arial, sans-serif; background: white; }
          .row-pair {
            height: 91mm; /* ajustado via JS após load */
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-bottom: 5mm;
            page-break-inside: avoid;
          }
          .row-pair:nth-child(3n) { page-break-after: always; margin-bottom: 0; }
          .carne { border: 1px dashed #555; padding: 6px 8px; background: white; font-size: 8px; display: flex; flex-direction: column; height: 100%; }
          .header { border-bottom: 1.5px solid #222; margin-bottom: 4px; padding-bottom: 3px; text-align: center; }
          .empresa-nome { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
          .empresa-sub { font-size: 6.5px; color: #444; margin-top: 1px; }
          .via-label { font-size: 6.5px; font-style: italic; color: #666; margin-top: 2px; }
          .field-row { display: flex; gap: 4px; margin-bottom: 3px; }
          .field-row.grid3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 4px; margin-bottom: 3px; }
          .field { display: flex; flex-direction: column; min-width: 0; }
          .field.full { flex: 1; }
          .flabel { font-weight: bold; font-size: 6px; color: #555; text-transform: uppercase; margin-bottom: 1px; }
          .fvalue { font-size: 7.5px; border-bottom: 1px solid #aaa; padding-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .fvalue.bold { font-weight: bold; font-size: 8.5px; }
          .instrucoes { font-size: 6px; color: #555; border: 0.5px solid #ccc; padding: 2px 4px; margin: 3px 0; line-height: 1.4; }
          .calc-section { margin: 3px 0; }
          .calc-row { display: flex; align-items: flex-end; gap: 4px; margin-bottom: 2px; }
          .calc-label { font-size: 6.5px; white-space: nowrap; min-width: 85px; }
          .calc-label.bold { font-weight: bold; }
          .calc-line { flex: 1; border-bottom: 1px solid #333; height: 9px; }
          .total-row .calc-line { border-bottom: 2px solid #000; }
          .barcode-area { text-align: center; margin-top: auto; padding-top: 3px; border-top: 1px solid #ddd; }
          .barcode { font-family: 'Libre Barcode 39', cursive; font-size: 34px; line-height: 1; }
          .barcode-num { font-size: 6.5px; letter-spacing: 2px; margin-top: 1px; font-family: 'Courier New', monospace; }
        </style>
      </head>
      <body>
        ${parcelas.map((p) => `
          <div class="row-pair">
            ${buildCarne(p, "1ª Via — Cliente")}
            ${buildCarne(p, "2ª Via — Empresa")}
          </div>
        `).join("")}
        <script>
          function ajustarAlturas() {
            // Mede a altura real da página e distribui 3 linhas perfeitamente
            var mmPx = document.createElement('div');
            mmPx.style.cssText = 'position:absolute;left:-9999px;width:100mm;height:1mm';
            document.body.appendChild(mmPx);
            var px1mm = mmPx.getBoundingClientRect().height;
            document.body.removeChild(mmPx);
            var paginaH = 277 * px1mm; // 297mm - 2x10mm margem
            var rows = document.querySelectorAll('.row-pair');
            var altH = Math.floor(paginaH / 3);
            rows.forEach(function(r) { r.style.height = altH + 'px'; });
          }
          function imprimir() { ajustarAlturas(); setTimeout(function() { window.print(); }, 100); }
          if (document.fonts) {
            document.fonts.ready.then(function() { setTimeout(imprimir, 150); });
          } else {
            setTimeout(imprimir, 600);
          }
        </script>
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  }

  function imprimirCarneDetalhe(de = 1, ate = Infinity) {
    if (!vendaDetalhe || !vendaDetalheInfo) return;
    const win = window.open("", "", "width=900,height=700");
    if (!win) {
      toast({ title: "Bloqueador de pop-ups ativado. Permita pop-ups para imprimir.", variant: "destructive" });
      return;
    }

    const nomeEmpresa = empresaConfig?.nome_fantasia || "EMPRESA";
    const telefone = empresaConfig?.telefone || "";
    const enderecoEmpresa = [
      empresaConfig?.endereco,
      empresaConfig?.bairro,
      [empresaConfig?.cidade, empresaConfig?.estado].filter(Boolean).join(" - "),
    ].filter(Boolean).join(", ");
    const cnpjEmpresa = empresaConfig?.cnpj || "";

    const clienteNome = vendaDetalheInfo.cliente;
    const loteamentoNome = vendaDetalheInfo.loteamento;
    const quadraNum = vendaDetalhe.lote?.quadra ?? "";
    const loteNum = vendaDetalhe.lote?.lote ?? "";
    const totalParcelas = vendaDetalhe.pagamentos.length;

    const jurosPct = Number(vendaDetalheInfo.porcentagem) || 1;
    const instrucoes = `Após o vencimento cobrar juros de ${jurosPct}% ao mês e multa de 2% sobre o valor da parcela.`;

    const todasParcelas = [...vendaDetalhe.pagamentos].sort((a, b) => a.numero_parcela - b.numero_parcela);
    const parcelas = todasParcelas.filter((p) => p.numero_parcela >= de && p.numero_parcela <= ate);

    function buildCarne(p: typeof parcelas[0], via: string): string {
      const docNum = `${String(vendaDetalheInfo!.id_venda).padStart(6, "0")}${String(p.numero_parcela).padStart(2, "0")}`;
      const isPago = p.situacao === "pago";
      return `
        <div class="carne${isPago ? " pago" : ""}">
          <div class="header">
            <div class="empresa-nome">${nomeEmpresa}</div>
            ${cnpjEmpresa ? `<div class="empresa-sub">CNPJ: ${cnpjEmpresa}</div>` : ""}
            ${enderecoEmpresa ? `<div class="empresa-sub">${enderecoEmpresa}${telefone ? ` · Tel: ${telefone}` : ""}</div>` : ""}
            <div class="via-label">${via}</div>
          </div>

          ${isPago ? `<div class="pago-overlay">PAGO</div>` : ""}

          <div class="field-row">
            <div class="field full">
              <span class="flabel">CLIENTE</span>
              <span class="fvalue">${clienteNome}</span>
            </div>
          </div>

          <div class="field-row grid3">
            <div class="field">
              <span class="flabel">LOTE</span>
              <span class="fvalue">${loteNum} — ${loteamentoNome}</span>
            </div>
            <div class="field">
              <span class="flabel">QUADRA</span>
              <span class="fvalue">${quadraNum}</span>
            </div>
            <div class="field">
              <span class="flabel">PARCELA</span>
              <span class="fvalue bold">${String(p.numero_parcela).padStart(2, "0")} / ${String(totalParcelas).padStart(2, "0")}</span>
            </div>
          </div>

          <div class="field-row grid3">
            <div class="field">
              <span class="flabel">DOCUMENTO</span>
              <span class="fvalue">${docNum}</span>
            </div>
            <div class="field">
              <span class="flabel">VENCIMENTO</span>
              <span class="fvalue">${fmtDate(p.vencimento)}</span>
            </div>
            <div class="field">
              <span class="flabel">VALOR</span>
              <span class="fvalue bold">${fmtCurrency(p.valor)}</span>
            </div>
          </div>

          <div class="field-row">
            <div class="field full">
              <span class="flabel">ENDEREÇO DO LOTEAMENTO</span>
              <span class="fvalue">${vendaDetalhe!.lote?.loteamento?.cidade ? [vendaDetalhe!.lote!.loteamento!.cidade, vendaDetalhe!.lote!.loteamento!.estado].filter(Boolean).join(" - ") : loteamentoNome}</span>
            </div>
          </div>

          <div class="instrucoes">${instrucoes}</div>

          <div class="calc-section">
            <div class="calc-row"><span class="calc-label">(+) Juros</span><span class="calc-line"></span></div>
            <div class="calc-row"><span class="calc-label">(+) Multa</span><span class="calc-line"></span></div>
            <div class="calc-row total-row"><span class="calc-label bold">(=) Valor Cobrado</span><span class="calc-line"></span></div>
          </div>

          <div class="barcode-area">
            <div class="barcode">*${docNum}*</div>
            <div class="barcode-num">${docNum}</div>
          </div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Carnê - Venda #${vendaDetalheInfo.id_venda}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 10mm; }
          body { font-family: Arial, sans-serif; background: white; }
          .row-pair {
            height: 91mm; /* ajustado via JS após load */
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-bottom: 5mm;
            page-break-inside: avoid;
          }
          .row-pair:nth-child(3n) { page-break-after: always; margin-bottom: 0; }
          .carne { border: 1px dashed #555; padding: 6px 8px; background: white; font-size: 8px; position: relative; overflow: hidden; display: flex; flex-direction: column; height: 100%; }
          .header { border-bottom: 1.5px solid #222; margin-bottom: 4px; padding-bottom: 3px; text-align: center; }
          .empresa-nome { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
          .empresa-sub { font-size: 6.5px; color: #444; margin-top: 1px; }
          .via-label { font-size: 6.5px; font-style: italic; color: #666; margin-top: 2px; }
          .pago.carne { opacity: 0.85; }
          .pago-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 30px; font-weight: bold; color: rgba(22,163,74,0.25); border: 4px solid rgba(22,163,74,0.25); padding: 4px 10px; pointer-events: none; white-space: nowrap; }
          .field-row { display: flex; gap: 4px; margin-bottom: 3px; }
          .field-row.grid3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 4px; margin-bottom: 3px; }
          .field { display: flex; flex-direction: column; min-width: 0; }
          .field.full { flex: 1; }
          .flabel { font-weight: bold; font-size: 6px; color: #555; text-transform: uppercase; margin-bottom: 1px; }
          .fvalue { font-size: 7.5px; border-bottom: 1px solid #aaa; padding-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .fvalue.bold { font-weight: bold; font-size: 8.5px; }
          .instrucoes { font-size: 6px; color: #555; border: 0.5px solid #ccc; padding: 2px 4px; margin: 3px 0; line-height: 1.4; }
          .calc-section { margin: 3px 0; }
          .calc-row { display: flex; align-items: flex-end; gap: 4px; margin-bottom: 2px; }
          .calc-label { font-size: 6.5px; white-space: nowrap; min-width: 85px; }
          .calc-label.bold { font-weight: bold; }
          .calc-line { flex: 1; border-bottom: 1px solid #333; height: 9px; }
          .total-row .calc-line { border-bottom: 2px solid #000; }
          .barcode-area { text-align: center; margin-top: auto; padding-top: 3px; border-top: 1px solid #ddd; }
          .barcode { font-family: 'Libre Barcode 39', cursive; font-size: 34px; line-height: 1; letter-spacing: 0; }
          .barcode-num { font-size: 6.5px; letter-spacing: 2px; margin-top: 1px; font-family: 'Courier New', monospace; }
        </style>
      </head>
      <body>
        ${parcelas.map((p) => `
          <div class="row-pair">
            ${buildCarne(p, "1ª Via — Cliente")}
            ${buildCarne(p, "2ª Via — Empresa")}
          </div>
        `).join("")}
        <script>
          function ajustarAlturas() {
            var mmPx = document.createElement('div');
            mmPx.style.cssText = 'position:absolute;left:-9999px;width:100mm;height:1mm';
            document.body.appendChild(mmPx);
            var px1mm = mmPx.getBoundingClientRect().height;
            document.body.removeChild(mmPx);
            var paginaH = 277 * px1mm;
            var gapTotal = 2 * 5 * px1mm; // 2 gaps de 5mm entre os 3 pares
            var rows = document.querySelectorAll('.row-pair');
            var altH = Math.floor((paginaH - gapTotal) / 3);
            rows.forEach(function(r) { r.style.height = altH + 'px'; });
          }
          function imprimir() { ajustarAlturas(); setTimeout(function() { window.print(); }, 100); }
          if (document.fonts) {
            document.fonts.ready.then(function() { setTimeout(imprimir, 150); });
          } else {
            setTimeout(imprimir, 600);
          }
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

  const valorParcela = Number(valorParcelaVenda) > 0 ? Number(valorParcelaVenda) : 0;
  const totalParcelado = Number(numParcelas) * valorParcela;
  const totalContrato = Number(valorEntrada) + totalParcelado;

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
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => { resetHistorico(); setHistoricoAberto(true); }}>
              <History className="h-4 w-4" />
              Lançar Histórico
            </Button>
            <Button size="sm" className="gap-2" onClick={() => { resetNovaVenda(); setNovaVendaAberto(true); }}>
              <Plus className="h-4 w-4" />
              Nova Venda
            </Button>
          </div>
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
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcela</th>
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
                        <td className="px-5 py-3 text-muted-foreground">{fmtCurrency(v.valor_parcela ?? 0)}</td>
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
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Nova Venda
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-full opacity-70 hover:opacity-100"
                onClick={() => { setNovaVendaAberto(false); resetNovaVenda(); }}
              >
                <span className="text-lg leading-none">×</span>
                <span className="sr-only">Fechar</span>
              </Button>
            </div>
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
                  <LoteamentoCombobox
                    loteamentos={loteamentos}
                    value={selectedLoteamento ? String(selectedLoteamento.id_loteamento) : ""}
                    onValueChange={(v) => {
                      const lot = loteamentos.find((l) => String(l.id_loteamento) === v) ?? null;
                      setSelectedLoteamento(lot);
                      setSelectedLote(null);
                    }}
                    className="mt-1.5"
                  />
                </div>

                {selectedLoteamento && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Selecione o Lote Disponível</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        title="Cadastrar novo lote"
                        onClick={() => setNovoLoteAberto(true)}
                      >
                        <Grid3X3 className="h-3.5 w-3.5" />
                        Novo Lote
                      </Button>
                    </div>
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

                {/* Card do cliente selecionado — sempre visível quando há seleção */}
                {selectedCliente && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-primary bg-primary/5 text-sm">
                    <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary truncate">{selectedCliente.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCliente.cpf ?? selectedCliente.cnpj ?? "Sem documento"}
                        {selectedCliente.cidade ? ` · ${selectedCliente.cidade}` : ""}
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  </div>
                )}

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {clientesFiltrados.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      {clienteSearch.trim() ? "Nenhum cliente encontrado" : "Digite o nome para buscar"}
                    </div>
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
                  <div>
                    <Label htmlFor="valor_parcela">Valor de Cada Parcela (R$)</Label>
                    <Input
                      id="valor_parcela"
                      type="number" min="0" step="0.01" placeholder="0,00"
                      value={valorParcelaVenda}
                      onChange={(e) => setValorParcelaVenda(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                {/* Cálculo preview */}
                {Number(valorParcelaVenda) > 0 && (
                  <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-2 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-3">Resumo da Venda</p>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">Valor da parcela</span>
                      <span className="font-semibold text-primary">{fmtCurrency(valorParcela)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{numParcelas}x de {fmtCurrency(valorParcela)}</span>
                      <span className="font-medium">{fmtCurrency(totalParcelado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entrada</span>
                      <span className="font-medium">{fmtCurrency(valorEntrada || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="font-semibold">Total do contrato</span>
                      <span className="font-bold text-primary">{fmtCurrency(totalContrato)}</span>
                    </div>
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
              <>
                <Button
                  onClick={() => criarVendaMutation.mutate()}
                  disabled={
                    criarVendaMutation.isPending ||
                    Number(valorParcelaVenda) <= 0 ||
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setNovaVendaAberto(false); resetNovaVenda(); }}
                  className="ml-auto"
                >
                  Sair
                </Button>
              </>
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

          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-sm min-w-[340px]">
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
                      <td className="py-2 px-3">
                        {vencimentoEditando === p.id_pagamento ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="date"
                              className="h-7 text-xs w-36"
                              value={vencimentoEditando_valor}
                              onChange={(e) => setVencimentoEditando_valor(e.target.value)}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => editarVencimentoMutation.mutate({ id_pagamento: p.id_pagamento, vencimento: vencimentoEditando_valor })}
                              disabled={editarVencimentoMutation.isPending}
                            >✓</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setVencimentoEditando(null)}>✕</Button>
                          </div>
                        ) : (
                          <button
                            className="text-muted-foreground hover:text-primary hover:underline text-left flex items-center gap-1 group"
                            onClick={() => { setVencimentoEditando(p.id_pagamento); setVencimentoEditando_valor(p.vencimento?.split("T")[0] ?? ""); }}
                            title="Clique para alterar vencimento"
                          >
                            {fmtDate(p.vencimento)}
                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                          </button>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">{fmtCurrency(p.valor)}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-xs">Aberto</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="border-t border-border pt-3 flex-col gap-3 items-stretch sm:items-stretch">
            {/* Impressão de Documentos */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Impressão de Documentos</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button" variant="ghost" size="sm"
                  className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border"
                  onClick={() => setContratoDialogAberto(true)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Contrato
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border"
                  onClick={() => setContratoDialogAberto(true)}
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  Contrato À Vista
                </Button>
                <Button
                  type="button" variant="secondary" size="sm"
                  className="gap-1.5 h-8 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-200 border"
                  onClick={() => { setContratoDialogAberto(true); setTimeout(() => window.dispatchEvent(new CustomEvent("abrir-recibo-quitacao")), 100); }}
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Recibo de Quitação
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border"
                  onClick={() => { setContratoDialogAberto(true); setTimeout(() => window.dispatchEvent(new CustomEvent("abrir-recibo-quitacao")), 100); }}
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Recibo s/ Timbrado
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border"
                  onClick={() => { setContratoDialogAberto(true); setTimeout(() => window.dispatchEvent(new CustomEvent("abrir-minuta")), 100); }}
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  Minuta
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border"
                  onClick={() => { setContratoDialogAberto(true); setTimeout(() => window.dispatchEvent(new CustomEvent("abrir-minuta-sem-timbrado")), 100); }}
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  Minuta s/ Timbrado
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border"
                  onClick={() => { setContratoDialogAberto(true); setTimeout(() => window.dispatchEvent(new CustomEvent("abrir-termo-transferencia")), 100); }}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Termo de Transferência
                </Button>
              </div>
            </div>
            {/* Ações */}
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <Button variant="outline" size="sm" onClick={() => abrirCarneRange("venda")} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir Carnê
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" className="gap-2"
                  onClick={() => {
                    setEditDataVenda(new Date().toISOString().split("T")[0]);
                    setEditEntrada("0");
                    setEditParcelas(String(vendaCriada?.pagamentos.length ?? 12));
                    setEditValorParcela(Number(vendaCriada?.pagamentos?.find((p) => p.numero_parcela === 1)?.valor ?? 0).toFixed(2));
                    setEditarVendaAberto(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Alterar Venda
                </Button>
                <Button size="sm" onClick={() => setDialogSucessoAberto(false)}>Fechar</Button>
              </div>
            </div>
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
                { label: "Parcelas", value: `${vendaDetalheInfo.parcelas}x · ${fmtCurrency(vendaDetalhe.valor_parcela ?? 0)}` },
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
          <div className="flex-1 overflow-x-auto overflow-y-auto border border-border rounded-lg">
            {!vendaDetalhe ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando parcelas...</div>
            ) : (
              <table className="w-full text-sm min-w-[520px]">
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
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => abrirCarneRange("detalhe")}
              disabled={!vendaDetalhe}
            >
              <Printer className="h-4 w-4" />
              Imprimir Carnê
            </Button>
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

      <NovoClienteDialog
        open={novoClienteAberto}
        onOpenChange={setNovoClienteAberto}
        isSubmitting={criarClienteRapidoMutation.isPending}
        submitLabel="Cadastrar cliente e selecionar"
        onSubmit={async (values) => {
          await criarClienteRapidoMutation.mutateAsync(values);
        }}
      />

      <NovoLoteDialog
        open={novoLoteAberto}
        onOpenChange={setNovoLoteAberto}
        defaultLoteamentoId={selectedLoteamento?.id_loteamento ?? null}
        onSuccess={(novoLote) => {
          setSelectedLote({
            id_lote: novoLote.id_lote,
            id_loteamento: novoLote.id_loteamento,
            lote: novoLote.lote,
            quadra: novoLote.quadra,
            area: novoLote.area,
            frente: novoLote.frente,
            status: "disponivel",
          });
        }}
      />

      {/* ── Dialog: Seleção de intervalo para impressão do carnê ── */}
      <Dialog open={carneRangeAberto} onOpenChange={setCarneRangeAberto}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Imprimir Carnê
            </DialogTitle>
            <DialogDescription>
              Selecione o intervalo de parcelas a imprimir.
              {carneTotalParcelas > 0 && (
                <span className="block mt-1 text-xs">Total: {carneTotalParcelas} parcela{carneTotalParcelas !== 1 ? "s" : ""}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs mb-1.5 block">Da parcela</Label>
                <Input
                  type="number"
                  min={1}
                  max={carneTotalParcelas}
                  value={carneDe}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(Number(e.target.value), carneAte));
                    setCarneDe(v);
                  }}
                />
              </div>
              <span className="mt-5 text-muted-foreground">até</span>
              <div className="flex-1">
                <Label className="text-xs mb-1.5 block">Até a parcela</Label>
                <Input
                  type="number"
                  min={carneDe}
                  max={carneTotalParcelas}
                  value={carneAte}
                  onChange={(e) => {
                    const v = Math.max(carneDe, Math.min(Number(e.target.value), carneTotalParcelas));
                    setCarneAte(v);
                  }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {carneAte - carneDe + 1} parcela{(carneAte - carneDe + 1) !== 1 ? "s" : ""} serão impressas
              {" "}(nº {carneDe} a {carneAte})
            </p>

            <div className="flex gap-2 flex-wrap justify-center">
              {carneTotalParcelas >= 12 && (
                <>
                  <Button type="button" variant="outline" size="sm" className="text-xs"
                    onClick={() => { setCarneDe(1); setCarneAte(Math.min(12, carneTotalParcelas)); }}>
                    1º Ano (1–12)
                  </Button>
                  {carneTotalParcelas >= 24 && (
                    <Button type="button" variant="outline" size="sm" className="text-xs"
                      onClick={() => { setCarneDe(13); setCarneAte(Math.min(24, carneTotalParcelas)); }}>
                      2º Ano (13–24)
                    </Button>
                  )}
                  {carneTotalParcelas >= 36 && (
                    <Button type="button" variant="outline" size="sm" className="text-xs"
                      onClick={() => { setCarneDe(25); setCarneAte(Math.min(36, carneTotalParcelas)); }}>
                      3º Ano (25–36)
                    </Button>
                  )}
                </>
              )}
              <Button type="button" variant="outline" size="sm" className="text-xs"
                onClick={() => { setCarneDe(1); setCarneAte(carneTotalParcelas); }}>
                Todas
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCarneRangeAberto(false)}>Cancelar</Button>
            <Button
              className="gap-2"
              onClick={() => {
                setCarneRangeAberto(false);
                if (carneModo === "venda") imprimirCarne(carneDe, carneAte);
                else imprimirCarneDetalhe(carneDe, carneAte);
              }}
            >
              <Printer className="h-4 w-4" />
              Imprimir
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

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — LANÇAR HISTÓRICO DE PAGAMENTOS
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={historicoAberto} onOpenChange={(open) => { if (!open) { setHistoricoAberto(false); resetHistorico(); } }}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Lançar Histórico de Pagamentos
            </DialogTitle>
            <DialogDescription>
              Registre o histórico de um lote vendido antes de usar este sistema.
            </DialogDescription>
            {/* Steps */}
            <div className="flex items-center gap-2 pt-1">
              {([
                { n: 1, label: "Lote", icon: MapPin },
                { n: 2, label: "Cliente", icon: User },
                { n: 3, label: "Venda", icon: DollarSign },
                { n: 4, label: "Parcelas", icon: ClipboardList },
              ] as const).map(({ n, label, icon: Icon }, i) => (
                <div key={n} className="flex items-center gap-1.5">
                  {i > 0 && <div className={`h-px w-6 ${historicoStep > n - 1 ? "bg-primary" : "bg-border"}`} />}
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${historicoStep === n ? "bg-primary text-primary-foreground" : historicoStep > n ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-3 w-3" />
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {/* Step 1 - Lote */}
            {historicoStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>Loteamento</Label>
                  <Select
                    value={histLoteamento ? String(histLoteamento.id_loteamento) : ""}
                    onValueChange={(v) => {
                      const lot = loteamentos.find((l) => String(l.id_loteamento) === v) ?? null;
                      setHistLoteamento(lot);
                      setHistLote(null);
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
                {histLoteamento && (
                  <div>
                    <Label>Selecione o Lote</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      {todosLotes.filter((l) => l.id_loteamento === histLoteamento.id_loteamento && l.status === "disponivel").length} lote(s) disponível(is)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                      {todosLotes
                        .filter((l) => l.id_loteamento === histLoteamento.id_loteamento && l.status === "disponivel")
                        .map((lote) => (
                          <button
                            key={lote.id_lote}
                            type="button"
                            onClick={() => setHistLote(lote)}
                            className={`text-left p-3 rounded-lg border text-sm transition-all ${
                              histLote?.id_lote === lote.id_lote
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                          >
                            <p className="font-semibold">Lote {lote.lote}</p>
                            <p className="text-xs text-muted-foreground">Quadra {lote.quadra}</p>
                            {lote.area && <p className="text-xs text-muted-foreground">{lote.area} m²</p>}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                {histLote && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span><span className="font-medium">Lote {histLote.lote}</span> — Quadra {histLote.quadra}{histLote.area ? ` — ${histLote.area} m²` : ""}</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 - Cliente */}
            {historicoStep === 2 && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CPF/CNPJ..."
                      value={histClienteSearch}
                      onChange={(e) => setHistClienteSearch(e.target.value)}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" title="Cadastrar novo cliente" onClick={() => setNovoClienteAberto(true)}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {clientes.filter((c) => !histClienteSearch.trim() || c.nome.toLowerCase().includes(histClienteSearch.toLowerCase()) || (c.cpf && c.cpf.includes(histClienteSearch))).map((c) => (
                    <button
                      key={c.id_cliente}
                      type="button"
                      onClick={() => setHistCliente(c)}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${histCliente?.id_cliente === c.id_cliente ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/50"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">{c.cpf ?? c.cnpj ?? "Sem documento"}{c.cidade ? ` · ${c.cidade}` : ""}</p>
                        </div>
                        {histCliente?.id_cliente === c.id_cliente && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 - Dados da Venda */}
            {historicoStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-xs">
                    <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wide">Lote</p>
                    <p className="font-semibold">{histLoteamento?.nome}</p>
                    <p>Lote {histLote?.lote} · Quadra {histLote?.quadra}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-xs">
                    <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wide">Cliente</p>
                    <p className="font-semibold">{histCliente?.nome}</p>
                    <p>{histCliente?.cpf ?? histCliente?.cnpj ?? "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data da Venda</Label>
                    <Input type="date" value={histDataVenda} onChange={(e) => setHistDataVenda(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Entrada Paga (R$)</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0,00" value={histEntrada} onChange={(e) => setHistEntrada(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Número de Parcelas</Label>
                    <Input type="number" min="1" step="1" value={histParcelas} onChange={(e) => setHistParcelas(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Valor de Cada Parcela (R$)</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0,00" value={histValorParcela} onChange={(e) => setHistValorParcela(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                {histValorParcela && Number(histValorParcela) > 0 && (
                  <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-2 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Resumo</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entrada</span>
                      <span>{fmtCurrency(histEntrada || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{histParcelas}x de</span>
                      <span className="font-semibold text-primary">{fmtCurrency(histValorParcela)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-primary">{fmtCurrency(Number(histEntrada) + Number(histParcelas) * Number(histValorParcela))}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      No próximo passo você poderá editar cada parcela individualmente e marcar as já pagas.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 4 - Parcelas editáveis */}
            {historicoStep === 4 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{histRows.length} parcela(s) — edite vencimento, valor e situação de cada uma</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => marcarTodas("pago")}>
                      <CheckCircle2 className="h-3 w-3" />
                      Marcar todas pagas
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => marcarTodas("aberto")}>
                      Limpar
                    </Button>
                  </div>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto overflow-y-auto max-h-[380px]">
                    <table className="w-full text-xs min-w-[480px]">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                        <tr className="border-b border-border">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10">#</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Vencimento</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Valor (R$)</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Situação</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data Pgto</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Valor Pago (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {histRows.map((row, idx) => (
                          <tr key={row.numero_parcela} className={`${row.situacao === "pago" ? "bg-green-50/50 dark:bg-green-900/10" : ""}`}>
                            <td className="px-3 py-1.5 font-medium text-muted-foreground">{String(row.numero_parcela).padStart(2, "0")}</td>
                            <td className="px-2 py-1">
                              <Input
                                type="date"
                                value={row.vencimento}
                                onChange={(e) => updateHistRow(idx, "vencimento", e.target.value)}
                                className="h-7 text-xs px-2 w-32"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number" min="0" step="0.01"
                                value={row.valor}
                                onChange={(e) => updateHistRow(idx, "valor", e.target.value)}
                                className="h-7 text-xs px-2 w-24"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Select
                                value={row.situacao}
                                onValueChange={(v) => updateHistRow(idx, "situacao", v)}
                              >
                                <SelectTrigger className="h-7 text-xs w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="aberto">Aberto</SelectItem>
                                  <SelectItem value="pago">Pago</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1">
                              {row.situacao === "pago" ? (
                                <Input
                                  type="date"
                                  value={row.pago_data}
                                  onChange={(e) => updateHistRow(idx, "pago_data", e.target.value)}
                                  className="h-7 text-xs px-2 w-32"
                                />
                              ) : <span className="text-muted-foreground px-2">—</span>}
                            </td>
                            <td className="px-2 py-1">
                              {row.situacao === "pago" ? (
                                <Input
                                  type="number" min="0" step="0.01"
                                  value={row.valor_pago}
                                  onChange={(e) => updateHistRow(idx, "valor_pago", e.target.value)}
                                  className="h-7 text-xs px-2 w-24"
                                />
                              ) : <span className="text-muted-foreground px-2">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Resumo das parcelas */}
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-2">
                  <span>
                    <span className="font-semibold text-green-600">{histRows.filter((r) => r.situacao === "pago").length}</span> pagas ·{" "}
                    <span className="font-semibold text-orange-500">{histRows.filter((r) => r.situacao === "aberto").length}</span> em aberto
                  </span>
                  <span>
                    Total parcelado: <span className="font-semibold">{fmtCurrency(histRows.reduce((s, r) => s + Number(r.valor), 0))}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-3 flex-row justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (historicoStep > 1) setHistoricoStep((s) => (s - 1) as 1 | 2 | 3 | 4);
                else { setHistoricoAberto(false); resetHistorico(); }
              }}
              className="gap-1"
            >
              {historicoStep > 1 && <ChevronLeft className="h-4 w-4" />}
              {historicoStep === 1 ? "Cancelar" : "Voltar"}
            </Button>

            {historicoStep < 3 ? (
              <Button
                onClick={() => setHistoricoStep((s) => (s + 1) as 2 | 3 | 4)}
                disabled={
                  (historicoStep === 1 && !histLote) ||
                  (historicoStep === 2 && !histCliente)
                }
                className="gap-1"
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            ) : historicoStep === 3 ? (
              <Button
                onClick={gerarLinhasHistorico}
                disabled={!histDataVenda || Number(histParcelas) < 1 || Number(histValorParcela) <= 0}
                className="gap-1"
              >
                Gerar Parcelas <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => lancarHistoricoMutation.mutate()}
                disabled={lancarHistoricoMutation.isPending || histRows.length === 0}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {lancarHistoricoMutation.isPending ? "Registrando..." : (
                  <>
                    <History className="h-4 w-4" />
                    Registrar Histórico
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog - Lote já vendido */}
      <AlertDialog open={!!loteJaVendido} onOpenChange={(open) => { if (!open) setLoteJaVendido(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Lote já possui uma venda ativa
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este lote já está vinculado a outra venda. Deseja cancelar a venda anterior e criar uma nova?
              <br /><br />
              Venda anterior: <span className="font-semibold">#{loteJaVendido?.id_venda}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resetNovaVenda()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!loteJaVendido) return;
                // Cancelar a venda anterior
                const r = await fetch(`/api/vendas/${loteJaVendido.id_venda}/cancelar`, {
                  method: "PATCH",
                  headers: { ...getAuthHeaders() }
                });
                if (!r.ok) {
                  toast({ title: "Erro ao cancelar venda anterior", variant: "destructive" });
                  return;
                }
                // Tentar criar nova venda
                setLoteJaVendido(null);
                await criarVendaMutation.mutateAsync();
              }}
            >
              Cancelar venda anterior e criar nova
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG — EDITAR VENDA
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={editarVendaAberto} onOpenChange={setEditarVendaAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Alterar Venda #{vendaCriada?.id_venda}
            </DialogTitle>
            <DialogDescription>Edite os dados da venda registrada.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Data da Venda</Label>
              <Input type="date" value={editDataVenda} onChange={(e) => setEditDataVenda(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Entrada (R$)</Label>
              <Input type="number" min="0" step="0.01" value={editEntrada} onChange={(e) => setEditEntrada(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nº de Parcelas</Label>
              <Input type="number" min="1" value={editParcelas} onChange={(e) => setEditParcelas(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Valor da Parcela (R$)</Label>
              <Input type="number" min="0" step="0.01" value={editValorParcela} onChange={(e) => setEditValorParcela(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditarVendaAberto(false)}>Cancelar</Button>
            <Button
              onClick={() => editarVendaMutation.mutate()}
              disabled={editarVendaMutation.isPending}
            >
              {editarVendaMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG — CONTRATO
      ═══════════════════════════════════════════════════════════════════════ */}
      {contratoDialogAberto && vendaCriadaCliente && (
        <ContratoDialog
          open={contratoDialogAberto}
          onClose={() => setContratoDialogAberto(false)}
          idCliente={vendaCriadaCliente.id}
          nomeCliente={vendaCriadaCliente.nome}
          idVenda={vendaCriada?.id_venda}
        />
      )}
    </AppLayout>
  );
};

export default Vendas;
