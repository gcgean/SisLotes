import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { DestructiveConfirmationDialog } from "@/components/ui/destructive-confirmation-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { formatDateBR } from "@/lib/date-br";
import { gerarPreviewParcelas, rotuloParcela } from "@/lib/parcelas";
import { VisaoGeralTab } from "@/components/financeiro/VisaoGeralTab";
import { ContasTab } from "@/components/financeiro/ContasTab";
import { LancamentosTab } from "@/components/financeiro/LancamentosTab";
import { ConciliacaoTab } from "@/components/financeiro/ConciliacaoTab";
import { CobrancasTab } from "@/components/financeiro/CobrancasTab";
import { ReguaCobrancaTab } from "@/components/financeiro/ReguaCobrancaTab";
import { OrcadoRealizadoTab } from "@/components/financeiro/OrcadoRealizadoTab";
import { FechamentoPeriodoTab } from "@/components/financeiro/FechamentoPeriodoTab";
import { RateioLoteamentoEditor, RateioLinha } from "@/components/financeiro/RateioLoteamentoEditor";
import { ComprovanteInput } from "@/components/financeiro/ComprovanteInput";
import { imprimirContasPagar } from "@/utils/contasPagar";
import type { ReciboEmpresa } from "@/utils/reciboParcela";
import {
  Plus,
  Printer,
  Receipt,
  Pencil,
  Trash2,
  Paperclip,
  CheckCircle2,
  RotateCcw,
  Search,
  Building2,
  Repeat,
  Info,
  AlertTriangle,
  Clock,
  CalendarClock,
  Split,
  Eye,
  Loader2,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
//  Tipos
// ═══════════════════════════════════════════════════════════════════════════

interface Loteamento {
  id_loteamento: number;
  nome: string;
}

interface Conta {
  id_conta: number;
  apelido: string;
  ativo: boolean;
  saldo_atual?: number;
}

interface PlanoConta {
  id_conta_contabil: number;
  id_pai: number | null;
  tipo: "receita" | "despesa";
  codigo: string;
  nome: string;
  ativo: boolean;
}

interface Fornecedor {
  id_fornecedor: number;
  nome: string;
  documento?: string | null;
  telefone?: string | null;
  email?: string | null;
  contato?: string | null;
  observacoes?: string | null;
  ativo: boolean;
}

interface DespesaResumo {
  id_despesa: number;
  id_loteamento: number | null;
  id_categoria: number;
  id_fornecedor: number | null;
  descricao: string;
  valor_total: string;
  numero_parcelas: number;
  documento?: string | null;
  observacoes?: string | null;
  anexo_nome?: string | null;
  created_at: string;
  loteamento_nome: string | null;
  categoria_nome: string | null;
  categoria_grupo: string | null;
  fornecedor_nome: string | null;
  parcelas_pagas: number;
  parcelas_total: number;
  valor_pago: string;
  recorrente: boolean;
  recorrencia_ativa: boolean;
  rateado_qtd?: number;
  vencimento: string | null;
  proxima_parcela_id?: number | null;
  proxima_parcela_valor?: string | null;
}

interface DespesaRateioItem {
  id_loteamento: number;
  percentual: string;
  loteamento_nome: string;
}

interface DespesaParcela {
  id_despesa_parcela: number;
  numero_parcela: number;
  vencimento: string;
  valor: string;
  situacao: "aberto" | "parcial" | "pago";
  pago_data: string | null;
  valor_pago: string | null;
  multa_paga?: string; juros_pagos?: string; desconto_obtido?: string;
  iss_retido?: string; irrf_retido?: string; inss_retido?: string;
  pagamentos?: Array<{id_parcela_pagamento:number;pago_data:string;valor_pago:string;conta_apelido:string;iss_retido?:string;irrf_retido?:string;inss_retido?:string;anexo_nome?:string|null;anexo_base64?:string|null}>;
  id_conta: number | null;
}
interface EmpresaFinanceira extends ReciboEmpresa { multa_percentual?: string; juros_percentual_dia?: string; carencia_dias?: number }

interface DespesaDetalhe extends DespesaResumo {
  parcelas: DespesaParcela[];
  rateio?: DespesaRateioItem[];
}

interface AlertaItem {
  id_despesa_parcela: number;
  id_despesa: number;
  descricao: string;
  loteamento_nome: string | null;
  vencimento: string;
  valor: number;
  diasAtraso: number;
}

interface AlertaBucket {
  qtd: number;
  valor: number;
  itens: AlertaItem[];
}

interface DespesasAlertas {
  atrasadas: AlertaBucket;
  hoje: AlertaBucket;
  mes: AlertaBucket;
}

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function fmtMoeda(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
export function encargosSugeridos(valor:number,vencimento:string|null,dataPagamento:string,empresa?:EmpresaFinanceira){if(!vencimento||dataPagamento<=vencimento)return{multa:0,juros:0,desconto:0};const dias=Math.floor((Date.UTC(...dataPagamento.split("-").map(Number).map((n,i)=>i===1?n-1:n) as [number,number,number])-Date.UTC(...vencimento.split("-").map(Number).map((n,i)=>i===1?n-1:n) as [number,number,number]))/86400000);const cobraveis=Math.max(0,dias-(empresa?.carencia_dias??0));if(!cobraveis)return{multa:0,juros:0,desconto:0};return{multa:Number((valor*Number(empresa?.multa_percentual??0)/100).toFixed(2)),juros:Number((valor*Number(empresa?.juros_percentual_dia??0)/100*cobraveis).toFixed(2)),desconto:0};}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractError(data: unknown, fallback: string): string {
  return typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
    ? (data as { error: string }).error
    : fallback;
}

const emptyDespesaForm = {
  id_loteamento: "",
  id_categoria: "",
  id_fornecedor: "",
  descricao: "",
  valor_total: "",
  numero_parcelas: "1",
  data_primeiro_vencimento: new Date().toISOString().slice(0, 10),
  documento: "",
  observacoes: "",
  anexo_nome: "",
  anexo_base64: "",
  recorrente: false,
};

const emptyCategoriaForm = { nome: "", tipo: "despesa" as "receita" | "despesa" };
const emptyFornecedorForm = { nome: "", documento: "", telefone: "", email: "", contato: "", observacoes: "" };

const ABAS_VALIDAS = ["visao-geral", "despesas", "categorias", "fornecedores", "contas", "lancamentos", "conciliacao", "cobrancas", "regua-cobranca", "orcado-realizado", "fechamento"] as const;

// ═══════════════════════════════════════════════════════════════════════════

export default function Despesas() {
  const queryClient = useQueryClient();

  // ─── Aba ativa (controlada pela URL, refletindo o submenu "Financeiro" do menu principal) ──
  const [searchParams, setSearchParams] = useSearchParams();
  const abaParam = searchParams.get("tab");
  const abaAtiva = (ABAS_VALIDAS as readonly string[]).includes(abaParam ?? "") ? (abaParam as string) : "visao-geral";
  function irParaAba(aba: string) {
    setSearchParams(aba === "visao-geral" ? {} : { tab: aba }, { replace: true });
  }

  // ─── Filtros da lista de despesas ────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filtroLoteamento, setFiltroLoteamento] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroSituacao, setFiltroSituacao] = useState<string>("todas");
  const [filtroAlerta, setFiltroAlerta] = useState<"atrasadas" | "hoje" | "mes" | null>(null);

  // ─── Dialogs: despesa ─────────────────────────────────────────────────────
  const [dialogDespesaAberto, setDialogDespesaAberto] = useState(false);
  const [modoDespesa, setModoDespesa] = useState<"novo" | "editar">("novo");
  const [despesaEditandoId, setDespesaEditandoId] = useState<number | null>(null);
  const [formDespesa, setFormDespesa] = useState(emptyDespesaForm);
  const [ratearDespesa, setRatearDespesa] = useState(false);
  const [rateioDespesa, setRateioDespesa] = useState<RateioLinha[]>([]);
  const [dialogAnexoAberto, setDialogAnexoAberto] = useState(false);
  const [carregandoAnexo, setCarregandoAnexo] = useState(false);
  const [dialogDetalheAberto, setDialogDetalheAberto] = useState(false);
  const [despesaSelecionadaId, setDespesaSelecionadaId] = useState<number | null>(null);
  const [dialogExcluirDespesa, setDialogExcluirDespesa] = useState<{ aberto: boolean; despesa: DespesaResumo | null }>({ aberto: false, despesa: null });
  const [parcelaParaEstorno, setParcelaParaEstorno] = useState<DespesaParcela | null>(null);
  const [tentouSalvarDespesa, setTentouSalvarDespesa] = useState(false);
  const [cadastroDestrutivo, setCadastroDestrutivo] = useState<{
    tipo: "categoria" | "fornecedor";
    acao: "desativar" | "excluir";
    id: number;
    nome: string;
  } | null>(null);

  // ─── Dialog: pagar parcela ────────────────────────────────────────────────
  const [dialogPagarAberto, setDialogPagarAberto] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<DespesaParcela | null>(null);
  const [formPagar, setFormPagar] = useState({ pago_data: new Date().toISOString().slice(0, 10), valor_base: "", multa: "0", juros: "0", desconto: "0", iss_retido: "0", irrf_retido: "0", inss_retido: "0", id_conta: "", anexo_nome: "", anexo_base64: "" });

  // ─── Pagamento em lote ─────────────────────────────────────────────────────
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [dialogPagarLoteAberto, setDialogPagarLoteAberto] = useState(false);
  const [formPagarLote, setFormPagarLote] = useState({ pago_data: new Date().toISOString().slice(0, 10), id_conta: "" });
  const [valoresLote, setValoresLote] = useState<Record<number, string>>({});

  // ─── Dialogs: plano de contas / fornecedor ─────────────────────────────────
  const [dialogCategoriaAberto, setDialogCategoriaAberto] = useState(false);
  const [categoriaEditandoId, setCategoriaEditandoId] = useState<number | null>(null);
  const [categoriaPaiId, setCategoriaPaiId] = useState<number | null>(null);
  const [formCategoria, setFormCategoria] = useState(emptyCategoriaForm);

  const [dialogFornecedorAberto, setDialogFornecedorAberto] = useState(false);
  const [fornecedorEditandoId, setFornecedorEditandoId] = useState<number | null>(null);
  const [formFornecedor, setFormFornecedor] = useState(emptyFornecedorForm);

  const headers = { "Content-Type": "application/json", ...getAuthHeaders() };

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: loteamentos = [] } = useQuery<Loteamento[]>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const r = await fetch("/api/loteamentos", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar loteamentos");
      return r.json();
    },
  });

  const { data: contas = [] } = useQuery<Conta[]>({
    queryKey: ["contas", "ativas"],
    queryFn: async () => {
      const r = await fetch("/api/contas?ativo=true", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar contas");
      return r.json();
    },
  });

  const { data: categorias = [], isError: erroCategorias, error: erroCategoriasMsg } = useQuery<PlanoConta[]>({
    queryKey: ["despesas-categorias"],
    queryFn: async () => {
      const r = await fetch("/api/despesas/plano-de-contas", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar plano de contas");
      return r.json();
    },
  });

  const { data: fornecedores = [], isError: erroFornecedores, error: erroFornecedoresMsg } = useQuery<Fornecedor[]>({
    queryKey: ["despesas-fornecedores"],
    queryFn: async () => {
      const r = await fetch("/api/despesas/fornecedores", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar fornecedores");
      return r.json();
    },
  });

  const { data: despesas = [], isLoading: isLoadingDespesas, isError: erroDespesas, error: erroDespesasMsg } = useQuery<DespesaResumo[]>({
    queryKey: ["despesas"],
    queryFn: async () => {
      const r = await fetch("/api/despesas", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar contas a pagar");
      return r.json();
    },
  });

  const { data: alertas } = useQuery<DespesasAlertas>({
    queryKey: ["despesas-alertas"],
    queryFn: async () => {
      const r = await fetch("/api/despesas/alertas", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar alertas de contas a pagar");
      return r.json();
    },
  });

  const { data: despesaDetalhe, isLoading: isLoadingDetalhe } = useQuery<DespesaDetalhe>({
    queryKey: ["despesa-detalhe", despesaSelecionadaId],
    enabled: despesaSelecionadaId != null && dialogDetalheAberto,
    queryFn: async () => {
      const r = await fetch(`/api/despesas/${despesaSelecionadaId}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar detalhe da conta a pagar");
      return r.json();
    },
  });

  useEffect(() => {
    if (erroDespesas) toast({ title: "Erro ao carregar contas a pagar", description: erroDespesasMsg instanceof Error ? erroDespesasMsg.message : undefined, variant: "destructive" });
  }, [erroDespesas, erroDespesasMsg]);
  useEffect(() => {
    if (erroCategorias) toast({ title: "Erro ao carregar categorias", description: erroCategoriasMsg instanceof Error ? erroCategoriasMsg.message : undefined, variant: "destructive" });
  }, [erroCategorias, erroCategoriasMsg]);
  useEffect(() => {
    if (erroFornecedores) toast({ title: "Erro ao carregar fornecedores", description: erroFornecedoresMsg instanceof Error ? erroFornecedoresMsg.message : undefined, variant: "destructive" });
  }, [erroFornecedores, erroFornecedoresMsg]);

  const categoriasSinteticas = new Set(categorias.map((c) => c.id_pai).filter((id): id is number => id !== null));
  const categoriasAtivas = categorias.filter((c) => c.ativo && c.tipo === "despesa" && !categoriasSinteticas.has(c.id_conta_contabil));
  const fornecedoresAtivos = fornecedores.filter((f) => f.ativo);

  function planoContaDepth(c: PlanoConta): number {
    return c.codigo.split(".").length - 1;
  }
  function planoContaLabel(c: PlanoConta): string {
    return `${c.codigo} — ${c.nome}`;
  }
  const categoriasOrdenadas = [...categorias].sort((a, b) =>
    a.codigo.localeCompare(b.codigo, undefined, { numeric: true })
  );

  // ─── Opções dos comboboxes pesquisáveis do formulário de conta a pagar ───────
  const loteamentoOptions: ComboboxOption[] = [
    { value: "none", label: "— Administrativa —" },
    ...loteamentos.map((l) => ({ value: String(l.id_loteamento), label: l.nome })),
  ];
  const categoriaOptions: ComboboxOption[] = categoriasAtivas
    .slice()
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
    .map((c) => ({
      value: String(c.id_conta_contabil),
      label: planoContaLabel(c),
      indent: planoContaDepth(c),
    }));
  const fornecedorOptions: ComboboxOption[] = [
    { value: "none", label: "— Nenhum —" },
    ...fornecedoresAtivos.map((f) => ({ value: String(f.id_fornecedor), label: f.nome })),
  ];

  const contaOptions: ComboboxOption[] = contas.map((c) => ({
    value: String(c.id_conta),
    label: `${c.apelido} · saldo ${fmtMoeda(c.saldo_atual ?? 0)}`,
  }));
  const previewParcelas = useMemo(() => gerarPreviewParcelas(
    Number(formDespesa.valor_total),
    formDespesa.recorrente ? 1 : Number(formDespesa.numero_parcelas),
    formDespesa.data_primeiro_vencimento,
  ), [formDespesa.valor_total, formDespesa.numero_parcelas, formDespesa.data_primeiro_vencimento, formDespesa.recorrente]);

  const totalRateioDespesa = rateioDespesa.reduce((s, l) => s + (Number(l.percentual.replace(",", ".")) || 0), 0);
  const rateioDespesaValido =
    !ratearDespesa || (rateioDespesa.length > 0 && Math.abs(totalRateioDespesa - 100) < 0.5 && rateioDespesa.every((r) => r.id_loteamento));

  const hojeIsoDespesas = new Date().toISOString().slice(0, 10);
  const idsFiltroAlerta = filtroAlerta && alertas
    ? new Set(alertas[filtroAlerta].itens.map((item) => item.id_despesa))
    : null;
  const despesasFiltradas = despesas.filter((d) => {
    if (idsFiltroAlerta && !idsFiltroAlerta.has(d.id_despesa)) return false;
    if (filtroLoteamento !== "todos") {
      if (filtroLoteamento === "administrativa" ? d.id_loteamento != null : d.id_loteamento !== Number(filtroLoteamento)) return false;
    }
    if (filtroCategoria !== "todas" && d.id_categoria !== Number(filtroCategoria)) return false;
    if (filtroSituacao !== "todas") {
      const situacao = d.parcelas_pagas === d.parcelas_total ? "pago" : d.parcelas_pagas === 0 ? "aberto" : "parcial";
      if (situacao !== filtroSituacao) return false;
    }
    if (search.trim()) {
      const v = search.toLowerCase();
      const matches = [d.descricao, d.loteamento_nome, d.categoria_nome, d.fornecedor_nome, d.documento]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(v));
      if (!matches) return false;
    }
    return true;
  });

  // ─── Impressão do relatório de contas a pagar ────────────────────────────
  const [usarTimbradoRelatorio, setUsarTimbradoRelatorio] = useState(true);

  const { data: empresaRelatorio } = useQuery<EmpresaFinanceira>({
    queryKey: ["minha-empresa"],
    queryFn: async () => {
      const r = await fetch("/api/empresas/minha", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar empresa");
      return r.json();
    },
  });

  function imprimirRelatorioContasPagar() {
    // O relatório sai exatamente com o que está filtrado na tela.
    const partes: string[] = [];
    if (filtroLoteamento === "administrativa") partes.push("Administrativas");
    else if (filtroLoteamento !== "todos") {
      partes.push(loteamentos.find((l) => String(l.id_loteamento) === filtroLoteamento)?.nome ?? "Loteamento");
    }
    if (filtroCategoria !== "todas") {
      partes.push(categorias.find((c) => String(c.id_conta_contabil) === filtroCategoria)?.nome ?? "Categoria");
    }
    if (filtroSituacao !== "todas") {
      partes.push({ aberto: "Em aberto", parcial: "Parcial", pago: "Pagas" }[filtroSituacao] ?? filtroSituacao);
    }
    if (search.trim()) partes.push(`Busca: "${search.trim()}"`);

    const ok = imprimirContasPagar(
      {
        filtrosLabel: partes.length > 0 ? partes.join(" · ") : "Todas as contas a pagar",
        contas: despesasFiltradas.map((d) => ({
          descricao: d.descricao,
          loteamento: d.loteamento_nome ?? (d.id_loteamento == null ? "Administrativa" : null),
          categoria: d.categoria_nome,
          fornecedor: d.fornecedor_nome,
          valorTotal: Number(d.valor_total),
          valorPago: Number(d.valor_pago),
          parcelasPagas: d.parcelas_pagas,
          parcelasTotal: d.parcelas_total,
          vencimento: d.vencimento,
          atrasada: Boolean(
            d.vencimento && d.vencimento < hojeIsoDespesas && d.parcelas_pagas < d.parcelas_total,
          ),
          recorrente: d.recorrente,
        })),
      },
      empresaRelatorio ?? null,
      usarTimbradoRelatorio,
    );

    if (!ok) {
      toast({
        title: "Não foi possível abrir a impressão",
        description: "Verifique se o bloqueador de pop-ups está desativado.",
        variant: "destructive",
      });
    }
  }

  const despesasSelecionadasParaPagar = despesas.filter((d) => selecionadas.has(d.id_despesa) && d.proxima_parcela_id);
  const totalSelecionadoLote = despesasSelecionadasParaPagar.reduce(
    (s, d) => s + Number((valoresLote[d.id_despesa] ?? d.proxima_parcela_valor ?? d.valor_total).toString().replace(",", ".") || 0),
    0
  );

  function toggleSelecionada(id: number, checked: boolean) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelecionarTodas(checked: boolean) {
    if (checked) {
      setSelecionadas(new Set(despesasFiltradas.filter((d) => d.proxima_parcela_id).map((d) => d.id_despesa)));
    } else {
      setSelecionadas(new Set());
    }
  }

  function abrirPagarLote() {
    setFormPagarLote({ pago_data: new Date().toISOString().slice(0, 10), id_conta: "" });
    setValoresLote({});
    setDialogPagarLoteAberto(true);
  }

  // ─── Mutations: despesa ───────────────────────────────────────────────────
  const salvarDespesaMutation = useMutation({
    mutationFn: async () => {
      const isEdicao = modoDespesa === "editar" && despesaEditandoId;
      const body: Record<string, unknown> = {
        id_loteamento: ratearDespesa ? null : formDespesa.id_loteamento ? Number(formDespesa.id_loteamento) : null,
        id_categoria: Number(formDespesa.id_categoria),
        id_fornecedor: formDespesa.id_fornecedor ? Number(formDespesa.id_fornecedor) : null,
        descricao: formDespesa.descricao.trim(),
        valor_total: Number(formDespesa.valor_total),
        documento: formDespesa.documento.trim() || null,
        observacoes: formDespesa.observacoes.trim() || null,
        anexo_nome: formDespesa.anexo_nome || null,
        anexo_base64: formDespesa.anexo_base64 || null,
      };
      if (!isEdicao) {
        body.numero_parcelas = formDespesa.recorrente ? 1 : Number(formDespesa.numero_parcelas) || 1;
        body.data_primeiro_vencimento = formDespesa.data_primeiro_vencimento;
        body.recorrente = formDespesa.recorrente;
        if (ratearDespesa) {
          body.rateio = rateioDespesa
            .filter((r) => r.id_loteamento && r.percentual)
            .map((r) => ({ id_loteamento: Number(r.id_loteamento), percentual: Number(r.percentual.replace(",", ".")) }));
        }
      }

      const url = isEdicao ? `/api/despesas/${despesaEditandoId}` : "/api/despesas";
      const r = await fetch(url, { method: isEdicao ? "PUT" : "POST", headers, body: JSON.stringify(body) });
      const data = await parseJson(r);
      if (!r.ok) throw new Error(extractError(data, "Erro ao salvar conta a pagar"));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-alertas"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      setDialogDespesaAberto(false);
      setTentouSalvarDespesa(false);
      setFormDespesa(emptyDespesaForm);
      toast({ title: modoDespesa === "novo" ? "Conta a pagar cadastrada" : "Conta a pagar atualizada" });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar conta a pagar", description: e.message, variant: "destructive" }),
  });

  const excluirDespesaMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/despesas/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!r.ok) {
        const data = await parseJson(r);
        throw new Error(extractError(data, "Erro ao excluir conta a pagar"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-alertas"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      setDialogExcluirDespesa({ aberto: false, despesa: null });
      toast({ title: "Conta a pagar excluída" });
    },
    onError: (e: Error) => toast({ title: "Não foi possível excluir", description: e.message, variant: "destructive" }),
  });

  const toggleRecorrenciaMutation = useMutation({
    mutationFn: async ({ id, ativa }: { id: number; ativa: boolean }) => {
      const r = await fetch(`/api/despesas/${id}/recorrencia`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ recorrencia_ativa: ativa }),
      });
      const data = await parseJson(r);
      if (!r.ok) throw new Error(extractError(data, "Erro ao alterar recorrência"));
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["despesa-detalhe", variables.id] });
      toast({ title: variables.ativa ? "Recorrência ativada" : "Recorrência pausada" });
    },
    onError: (e: Error) => toast({ title: "Erro ao alterar recorrência", description: e.message, variant: "destructive" }),
  });

  const pagarParcelaMutation = useMutation({
    mutationFn: async () => {
      if (!parcelaSelecionada) throw new Error("Parcela não selecionada");
      const body = {
        pago_data: formPagar.pago_data,
        valor_base: Number(formPagar.valor_base), multa: Number(formPagar.multa), juros: Number(formPagar.juros), desconto: Number(formPagar.desconto),
        iss_retido: Number(formPagar.iss_retido), irrf_retido: Number(formPagar.irrf_retido), inss_retido: Number(formPagar.inss_retido),
        id_conta: formPagar.id_conta ? Number(formPagar.id_conta) : null,
        anexo_nome: formPagar.anexo_nome || null,
        anexo_base64: formPagar.anexo_base64 || null,
      };
      const r = await fetch(`/api/despesas/parcelas/${parcelaSelecionada.id_despesa_parcela}/pagar`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await parseJson(r);
      if (!r.ok) throw new Error(extractError(data, "Erro ao registrar pagamento"));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-alertas"] });
      queryClient.invalidateQueries({ queryKey: ["despesa-detalhe", despesaSelecionadaId] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      setDialogPagarAberto(false);
      toast({ title: "Parcela paga com sucesso" });
    },
    onError: (e: Error) => toast({ title: "Erro ao pagar parcela", description: e.message, variant: "destructive" }),
  });

  const pagarLoteMutation = useMutation({
    mutationFn: async () => {
      const itens = despesasSelecionadasParaPagar.map((d) => ({
        id_despesa_parcela: d.proxima_parcela_id!,
        valor_pago: Number((valoresLote[d.id_despesa] ?? d.proxima_parcela_valor ?? d.valor_total).toString().replace(",", ".")),
        ...encargosSugeridos(Number(valoresLote[d.id_despesa] ?? d.proxima_parcela_valor ?? d.valor_total),d.vencimento,formPagarLote.pago_data,empresaRelatorio),
      }));
      const body = {
        pago_data: formPagarLote.pago_data,
        id_conta: Number(formPagarLote.id_conta),
        itens,
      };
      const r = await fetch("/api/despesas/parcelas/pagar-lote", { method: "POST", headers, body: JSON.stringify(body) });
      const data = await parseJson(r);
      if (!r.ok) throw new Error(extractError(data, "Erro ao pagar em lote"));
      return data as { pagas: number; ignoradas: { id_despesa_parcela: number; motivo: string }[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-alertas"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      setDialogPagarLoteAberto(false);
      setSelecionadas(new Set());
      setValoresLote({});
      toast({
        title: `${data.pagas} parcela(s) paga(s)`,
        description: data.ignoradas.length > 0 ? `${data.ignoradas.length} ignorada(s) (já paga ou não encontrada).` : undefined,
      });
    },
    onError: (e: Error) => toast({ title: "Erro ao pagar em lote", description: e.message, variant: "destructive" }),
  });

  const estornarParcelaMutation = useMutation({
    mutationFn: async (idParcela: number) => {
      const r = await fetch(`/api/despesas/parcelas/${idParcela}/estornar`, { method: "POST", headers: getAuthHeaders() });
      const data = await parseJson(r);
      if (!r.ok) throw new Error(extractError(data, "Erro ao estornar parcela"));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-alertas"] });
      queryClient.invalidateQueries({ queryKey: ["despesa-detalhe", despesaSelecionadaId] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      setParcelaParaEstorno(null);
      toast({ title: "Parcela estornada" });
    },
    onError: (e: Error) => toast({ title: "Erro ao estornar", description: e.message, variant: "destructive" }),
  });

  // ─── Mutations: plano de contas ───────────────────────────────────────────
  const salvarCategoriaMutation = useMutation({
    mutationFn: async () => {
      const isEdicao = Boolean(categoriaEditandoId);
      const body: Record<string, unknown> = { nome: formCategoria.nome.trim() };
      if (!isEdicao) {
        body.id_pai = categoriaPaiId;
        body.tipo = formCategoria.tipo;
      }
      const url = isEdicao ? `/api/despesas/plano-de-contas/${categoriaEditandoId}` : "/api/despesas/plano-de-contas";
      const r = await fetch(url, { method: isEdicao ? "PUT" : "POST", headers, body: JSON.stringify(body) });
      const data = await parseJson(r);
      if (!r.ok) throw new Error(extractError(data, "Erro ao salvar conta"));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-categorias"] });
      setDialogCategoriaAberto(false);
      toast({ title: "Conta salva" });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar conta", description: e.message, variant: "destructive" }),
  });

  const toggleCategoriaMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      const r = await fetch(`/api/despesas/plano-de-contas/${id}`, { method: "PUT", headers, body: JSON.stringify({ ativo }) });
      if (!r.ok) throw new Error("Erro ao alterar status");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["despesas-categorias"] }),
    onError: () => toast({ title: "Erro ao alterar status da conta", variant: "destructive" }),
  });

  const excluirCategoriaMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/despesas/plano-de-contas/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!r.ok) {
        const data = await parseJson(r);
        throw new Error(extractError(data, "Erro ao excluir categoria"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-categorias"] });
      toast({ title: "Categoria excluída" });
    },
    onError: (e: Error) => toast({ title: "Não foi possível excluir", description: e.message, variant: "destructive" }),
  });

  // ─── Mutations: fornecedor ────────────────────────────────────────────────
  const salvarFornecedorMutation = useMutation({
    mutationFn: async () => {
      const isEdicao = Boolean(fornecedorEditandoId);
      const body = {
        nome: formFornecedor.nome.trim(),
        documento: formFornecedor.documento.trim() || null,
        telefone: formFornecedor.telefone.trim() || null,
        email: formFornecedor.email.trim() || null,
        contato: formFornecedor.contato.trim() || null,
        observacoes: formFornecedor.observacoes.trim() || null,
      };
      const url = isEdicao ? `/api/despesas/fornecedores/${fornecedorEditandoId}` : "/api/despesas/fornecedores";
      const r = await fetch(url, { method: isEdicao ? "PUT" : "POST", headers, body: JSON.stringify(body) });
      const data = await parseJson(r);
      if (!r.ok) throw new Error(extractError(data, "Erro ao salvar fornecedor"));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-fornecedores"] });
      setDialogFornecedorAberto(false);
      toast({ title: "Fornecedor salvo" });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar fornecedor", description: e.message, variant: "destructive" }),
  });

  const toggleFornecedorMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      const r = await fetch(`/api/despesas/fornecedores/${id}/ativo`, { method: "PATCH", headers, body: JSON.stringify({ ativo }) });
      if (!r.ok) throw new Error("Erro ao alterar status");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["despesas-fornecedores"] }),
    onError: () => toast({ title: "Erro ao alterar status do fornecedor", variant: "destructive" }),
  });

  const excluirFornecedorMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/despesas/fornecedores/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!r.ok) {
        const data = await parseJson(r);
        throw new Error(extractError(data, "Erro ao excluir fornecedor"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-fornecedores"] });
      toast({ title: "Fornecedor excluído" });
    },
    onError: (e: Error) => toast({ title: "Não foi possível excluir", description: e.message, variant: "destructive" }),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────
  function abrirNovaDespesa() {
    setModoDespesa("novo");
    setDespesaEditandoId(null);
    setFormDespesa(emptyDespesaForm);
    setRatearDespesa(false);
    setRateioDespesa([]);
    setTentouSalvarDespesa(false);
    setDialogDespesaAberto(true);
  }

  // Proposta vinda do assistente de IA: abre o formulário já preenchido para o
  // usuário conferir e confirmar. A IA nunca grava — a gravação é este submit.
  const propostaAplicadaRef = useRef(false);
  useEffect(() => {
    if (propostaAplicadaRef.current) return;
    if (searchParams.get("nova") !== "1") return;
    propostaAplicadaRef.current = true;

    const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? String(Number(v)) : "");
    setModoDespesa("novo");
    setDespesaEditandoId(null);
    setFormDespesa({
      ...emptyDespesaForm,
      descricao: searchParams.get("descricao") ?? "",
      valor_total: num(searchParams.get("valor_total")),
      numero_parcelas: num(searchParams.get("numero_parcelas")) || "1",
      data_primeiro_vencimento:
        searchParams.get("data_primeiro_vencimento") ?? emptyDespesaForm.data_primeiro_vencimento,
      id_loteamento: num(searchParams.get("id_loteamento")),
    });
    setRatearDespesa(false);
    setRateioDespesa([]);
    setTentouSalvarDespesa(false);
    setDialogDespesaAberto(true);

    // Limpa os parâmetros para o formulário não reabrir a cada re-render.
    const limpos = new URLSearchParams(searchParams);
    ["nova", "descricao", "valor_total", "numero_parcelas", "data_primeiro_vencimento", "id_loteamento"].forEach(
      (k) => limpos.delete(k),
    );
    setSearchParams(limpos, { replace: true });
    toast({
      title: "Proposta do assistente",
      description: "Confira os dados e clique em salvar para efetivar.",
    });
  }, [searchParams, setSearchParams]);

  function abrirEditarDespesa(d: DespesaResumo) {
    setModoDespesa("editar");
    setDespesaEditandoId(d.id_despesa);
    setFormDespesa({
      id_loteamento: d.id_loteamento ? String(d.id_loteamento) : "",
      id_categoria: String(d.id_categoria),
      id_fornecedor: d.id_fornecedor ? String(d.id_fornecedor) : "",
      descricao: d.descricao,
      valor_total: d.valor_total,
      numero_parcelas: String(d.numero_parcelas),
      data_primeiro_vencimento: emptyDespesaForm.data_primeiro_vencimento,
      documento: d.documento ?? "",
      observacoes: d.observacoes ?? "",
      anexo_nome: d.anexo_nome ?? "",
      anexo_base64: "",
      recorrente: d.recorrente,
    });
    setRatearDespesa(false);
    setRateioDespesa([]);
    setTentouSalvarDespesa(false);
    setDialogDespesaAberto(true);
  }

  function abrirDetalheDespesa(id: number) {
    setDespesaSelecionadaId(id);
    setDialogDetalheAberto(true);
  }

  function abrirPagarParcela(parcela: DespesaParcela) {
    setParcelaSelecionada(parcela);
    const liquidado=Math.max(0,Number(parcela.valor_pago??0)-Number(parcela.multa_paga??0)-Number(parcela.juros_pagos??0)+Number(parcela.desconto_obtido??0)+Number(parcela.iss_retido??0)+Number(parcela.irrf_retido??0)+Number(parcela.inss_retido??0));
    const restante=Math.max(0,Number(parcela.valor)-liquidado);const data=new Date().toISOString().slice(0,10),e=encargosSugeridos(restante,parcela.vencimento,data,empresaRelatorio);
    setFormPagar({pago_data:data,valor_base:restante.toFixed(2),multa:String(e.multa),juros:String(e.juros),desconto:"0",iss_retido:"0",irrf_retido:"0",inss_retido:"0",id_conta:"",anexo_nome:"",anexo_base64:""});
    setDialogPagarAberto(true);
  }

  function handleAnexoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormDespesa((f) => ({ ...f, anexo_nome: file.name, anexo_base64: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  }

  async function abrirPreviewAnexo() {
    // Se já temos o conteúdo em memória (anexo recém-selecionado), só abre.
    if (formDespesa.anexo_base64) {
      setDialogAnexoAberto(true);
      return;
    }
    // Editando uma despesa existente: o anexo salvo não vem na lista, busca o detalhe.
    if (!despesaEditandoId) return;
    setCarregandoAnexo(true);
    try {
      const r = await fetch(`/api/despesas/${despesaEditandoId}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar anexo");
      const data = await r.json();
      if (!data.anexo_base64) {
        toast({ title: "Anexo indisponível", description: "Não foi possível carregar o arquivo.", variant: "destructive" });
        return;
      }
      setFormDespesa((f) => ({ ...f, anexo_base64: data.anexo_base64 }));
      setDialogAnexoAberto(true);
    } catch (e) {
      toast({ title: "Erro ao carregar anexo", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setCarregandoAnexo(false);
    }
  }

  function abrirNovaContaRaiz() {
    setCategoriaEditandoId(null);
    setCategoriaPaiId(null);
    setFormCategoria(emptyCategoriaForm);
    setDialogCategoriaAberto(true);
  }
  function abrirNovaSubconta(pai: PlanoConta) {
    setCategoriaEditandoId(null);
    setCategoriaPaiId(pai.id_conta_contabil);
    setFormCategoria({ nome: "", tipo: pai.tipo });
    setDialogCategoriaAberto(true);
  }
  function abrirEditarCategoria(c: PlanoConta) {
    setCategoriaEditandoId(c.id_conta_contabil);
    setCategoriaPaiId(c.id_pai);
    setFormCategoria({ nome: c.nome, tipo: c.tipo });
    setDialogCategoriaAberto(true);
  }

  function abrirNovoFornecedor() {
    setFornecedorEditandoId(null);
    setFormFornecedor(emptyFornecedorForm);
    setDialogFornecedorAberto(true);
  }
  function abrirEditarFornecedor(f: Fornecedor) {
    setFornecedorEditandoId(f.id_fornecedor);
    setFormFornecedor({
      nome: f.nome,
      documento: f.documento ?? "",
      telefone: f.telefone ?? "",
      email: f.email ?? "",
      contato: f.contato ?? "",
      observacoes: f.observacoes ?? "",
    });
    setDialogFornecedorAberto(true);
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              Financeiro
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Receitas, despesas, contas, saldo e resultado por loteamento.
            </p>
          </div>
        </div>

        <Tabs value={abaAtiva} onValueChange={irParaAba}>
          <TabsContent value="visao-geral" className="mt-0">
            <VisaoGeralTab />
          </TabsContent>

          {/* ─── Aba Despesas ─────────────────────────────────────────────── */}
          <TabsContent value="despesas" className="mt-0 space-y-4">
            {alertas && (alertas.atrasadas.qtd > 0 || alertas.hoje.qtd > 0 || alertas.mes.qtd > 0) && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button type="button" aria-pressed={filtroAlerta === "atrasadas"} onClick={() => setFiltroAlerta((atual) => atual === "atrasadas" ? null : "atrasadas")} className={cn("rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 flex items-start gap-3 text-left transition-all hover:ring-2 hover:ring-red-300", filtroAlerta === "atrasadas" && "ring-2 ring-red-500")}>
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wide">Atrasadas</p>
                      <p className="text-lg font-bold text-red-700 dark:text-red-400 leading-tight">{alertas.atrasadas.qtd}</p>
                      <p className="text-xs text-red-600/80 dark:text-red-400/70">{fmtMoeda(alertas.atrasadas.valor)}</p>
                    </div>
                  </button>
                  <button type="button" aria-pressed={filtroAlerta === "hoje"} onClick={() => setFiltroAlerta((atual) => atual === "hoje" ? null : "hoje")} className={cn("rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 flex items-start gap-3 text-left transition-all hover:ring-2 hover:ring-amber-300", filtroAlerta === "hoje" && "ring-2 ring-amber-500")}>
                    <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">Vence hoje</p>
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-400 leading-tight">{alertas.hoje.qtd}</p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/70">{fmtMoeda(alertas.hoje.valor)}</p>
                    </div>
                  </button>
                  <button type="button" aria-pressed={filtroAlerta === "mes"} onClick={() => setFiltroAlerta((atual) => atual === "mes" ? null : "mes")} className={cn("rounded-lg border border-sky-200 bg-sky-50 dark:bg-sky-950/20 dark:border-sky-900 p-3 flex items-start gap-3 text-left transition-all hover:ring-2 hover:ring-sky-300", filtroAlerta === "mes" && "ring-2 ring-sky-500")}>
                    <CalendarClock className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-sky-700 dark:text-sky-400 uppercase tracking-wide">Vence este mês</p>
                      <p className="text-lg font-bold text-sky-700 dark:text-sky-400 leading-tight">{alertas.mes.qtd}</p>
                      <p className="text-xs text-sky-600/80 dark:text-sky-400/70">{fmtMoeda(alertas.mes.valor)}</p>
                    </div>
                  </button>
                </div>

                {filtroAlerta && <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>Filtro ativo: <strong>{filtroAlerta === "atrasadas" ? "Atrasadas" : filtroAlerta === "hoje" ? "Vence hoje" : "Vence este mês"}</strong></span><Button type="button" size="sm" variant="ghost" onClick={() => setFiltroAlerta(null)}>Limpar filtro</Button></div>}

                {(alertas.atrasadas.itens.length > 0 || alertas.hoje.itens.length > 0) && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Precisam de atenção
                    </div>
                    <div className="divide-y">
                      {[...alertas.atrasadas.itens, ...alertas.hoje.itens].slice(0, 8).map((item) => (
                        <button
                          key={item.id_despesa_parcela}
                          type="button"
                          onClick={() => abrirDetalheDespesa(item.id_despesa)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/30 transition-colors text-left"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{item.descricao}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.loteamento_nome ?? "Administrativa"} · vence {formatDateBR(item.vencimento)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.diasAtraso > 0 && (
                              <Badge className="bg-red-100 text-red-700 border-red-200">{item.diasAtraso}d atraso</Badge>
                            )}
                            <span className="font-semibold">{fmtMoeda(item.valor)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={filtroLoteamento} onValueChange={setFiltroLoteamento}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Loteamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os loteamentos</SelectItem>
                    <SelectItem value="administrativa">Administrativa</SelectItem>
                    {loteamentos.map((l) => (
                      <SelectItem key={l.id_loteamento} value={String(l.id_loteamento)}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as categorias</SelectItem>
                    {categoriasOrdenadas.filter((c) => c.tipo === "despesa").map((c) => (
                      <SelectItem key={c.id_conta_contabil} value={String(c.id_conta_contabil)}>
                        {"  ".repeat(planoContaDepth(c))}{planoContaLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Situação" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="aberto">Em aberto</SelectItem>
                    <SelectItem value="parcial">Parcialmente paga</SelectItem>
                    <SelectItem value="pago">Paga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                {selecionadas.size > 0 && (
                  <Button size="sm" variant="secondary" className="gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200" onClick={abrirPagarLote}>
                    <CheckCircle2 className="h-4 w-4" /> Pagar selecionadas ({selecionadas.size})
                  </Button>
                )}
                <div className="flex items-center gap-1.5">
                  <Switch id="timbrado-contas-pagar" checked={usarTimbradoRelatorio} onCheckedChange={setUsarTimbradoRelatorio} />
                  <Label htmlFor="timbrado-contas-pagar" className="text-xs text-muted-foreground cursor-pointer">
                    Com timbrado
                  </Label>
                </div>
                <Button size="sm" variant="outline" className="gap-2" onClick={imprimirRelatorioContasPagar}>
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
                <Button size="sm" className="gap-2" onClick={abrirNovaDespesa}>
                  <Plus className="h-4 w-4" /> Nova Conta a Pagar
                </Button>
              </div>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-semibold w-8">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                        checked={despesasFiltradas.length > 0 && despesasFiltradas.filter((d) => d.proxima_parcela_id).every((d) => selecionadas.has(d.id_despesa))}
                        onChange={(e) => toggleSelecionarTodas(e.target.checked)}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                    <th className="px-4 py-3 text-left font-semibold">Loteamento</th>
                    <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold">Fornecedor</th>
                    <th className="px-4 py-3 text-left font-semibold">Valor</th>
                    <th className="px-4 py-3 text-left font-semibold">Parcelas</th>
                    <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                    <th className="px-4 py-3 text-left font-semibold">Situação</th>
                    <th className="px-4 py-3 text-left font-semibold sticky right-0 bg-muted/95 shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingDespesas ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
                  ) : despesasFiltradas.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Nenhuma conta a pagar encontrada.</td></tr>
                  ) : (
                    despesasFiltradas.map((d) => {
                      const situacao = d.parcelas_pagas === d.parcelas_total ? "pago" : d.parcelas_pagas === 0 ? "aberto" : "parcial";
                      return (
                        <tr key={d.id_despesa} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => abrirDetalheDespesa(d.id_despesa)}>
                          <td className="px-4 py-3 sticky right-0 bg-background shadow-[-4px_0_8px_rgba(0,0,0,0.04)]" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                              checked={selecionadas.has(d.id_despesa)}
                              disabled={!d.proxima_parcela_id}
                              onChange={(e) => toggleSelecionada(d.id_despesa, e.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium flex items-center gap-1.5">
                              {d.descricao}
                              {d.anexo_nome && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                              {d.recorrente && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Repeat className={cn("h-3 w-3 shrink-0", d.recorrencia_ativa ? "text-emerald-600" : "text-muted-foreground")} />
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    {d.recorrencia_ativa ? "Conta recorrente (ativa)" : "Conta recorrente (pausada)"}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {d.documento && <div className="text-xs text-muted-foreground">NF: {d.documento}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {(d.rateado_qtd ?? 0) > 0 ? (
                              <Badge variant="outline" className="gap-1">
                                <Split className="h-3 w-3" /> {d.rateado_qtd} loteamentos
                              </Badge>
                            ) : d.loteamento_nome ? (
                              <span className="flex items-center gap-1"><Building2 className="h-3 w-3 text-muted-foreground" />{d.loteamento_nome}</span>
                            ) : (
                              <Badge variant="secondary">Administrativa</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{d.categoria_nome ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{d.fornecedor_nome ?? "—"}</td>
                          <td className="px-4 py-3 font-medium">{fmtMoeda(d.valor_total)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{d.recorrente ? `${d.parcelas_pagas} paga(s) · recorrente` : `${d.parcelas_pagas} de ${d.parcelas_total} pagas`}</td>
                          <td className="px-4 py-3">
                            {d.vencimento ? (
                              <span
                                className={cn(
                                  situacao !== "pago" && d.vencimento < hojeIsoDespesas && "text-red-600 font-medium",
                                  situacao !== "pago" && d.vencimento === hojeIsoDespesas && "text-amber-600 font-medium",
                                  (situacao === "pago" || d.vencimento > hojeIsoDespesas) && "text-muted-foreground"
                                )}
                              >
                                {formatDateBR(d.vencimento)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {situacao === "pago" && <Badge className="bg-green-100 text-green-700 border-green-200">Paga</Badge>}
                            {situacao === "aberto" && <Badge variant="outline">Em aberto</Badge>}
                            {situacao === "parcial" && <Badge className="bg-amber-100 text-amber-700 border-amber-200">Parcial</Badge>}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => abrirEditarDespesa(d)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Excluir"
                                onClick={() => setDialogExcluirDespesa({ aberto: true, despesa: d })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ─── Aba Plano de Contas ──────────────────────────────────────── */}
          <TabsContent value="categorias" className="mt-0 space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-2" onClick={abrirNovaContaRaiz}>
                <Plus className="h-4 w-4" /> Nova Conta Raiz
              </Button>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-semibold">Código</th>
                    <th className="px-4 py-3 text-left font-semibold">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriasOrdenadas.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma conta cadastrada.</td></tr>
                  ) : (
                    categoriasOrdenadas.map((c) => (
                      <tr key={c.id_conta_contabil} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.codigo}</td>
                        <td className="px-4 py-3 font-medium" style={{ paddingLeft: `${16 + planoContaDepth(c) * 20}px` }}>
                          {c.nome}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize">{c.tipo}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {c.ativo ? <Badge className="bg-green-100 text-green-700 border-green-200">Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => abrirNovaSubconta(c)}>
                              + Sub-conta
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => c.ativo ? setCadastroDestrutivo({ tipo: "categoria", acao: "desativar", id: c.id_conta_contabil, nome: `${c.codigo} — ${c.nome}` }) : toggleCategoriaMutation.mutate({ id: c.id_conta_contabil, ativo: true })}>
                              {c.ativo ? "Desativar" : "Ativar"}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEditarCategoria(c)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setCadastroDestrutivo({ tipo: "categoria", acao: "excluir", id: c.id_conta_contabil, nome: `${c.codigo} — ${c.nome}` })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ─── Aba Fornecedores ─────────────────────────────────────────── */}
          <TabsContent value="fornecedores" className="mt-0 space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-2" onClick={abrirNovoFornecedor}>
                <Plus className="h-4 w-4" /> Novo Fornecedor
              </Button>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-semibold">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold">Documento</th>
                    <th className="px-4 py-3 text-left font-semibold">Contato</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {fornecedores.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum fornecedor cadastrado.</td></tr>
                  ) : (
                    fornecedores.map((f) => (
                      <tr key={f.id_fornecedor} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{f.nome}</td>
                        <td className="px-4 py-3 text-muted-foreground">{f.documento ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {f.telefone ?? f.email ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {f.ativo ? <Badge className="bg-green-100 text-green-700 border-green-200">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => f.ativo ? setCadastroDestrutivo({ tipo: "fornecedor", acao: "desativar", id: f.id_fornecedor, nome: f.nome }) : toggleFornecedorMutation.mutate({ id: f.id_fornecedor, ativo: true })}>
                              {f.ativo ? "Desativar" : "Ativar"}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEditarFornecedor(f)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setCadastroDestrutivo({ tipo: "fornecedor", acao: "excluir", id: f.id_fornecedor, nome: f.nome })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="contas" className="mt-0">
            <ContasTab />
          </TabsContent>

          <TabsContent value="lancamentos" className="mt-0">
            <LancamentosTab />
          </TabsContent>
          <TabsContent value="conciliacao" className="mt-0"><ConciliacaoTab /></TabsContent>
          <TabsContent value="cobrancas" className="mt-0"><CobrancasTab /></TabsContent>
          <TabsContent value="regua-cobranca" className="mt-0"><ReguaCobrancaTab /></TabsContent>
          <TabsContent value="orcado-realizado" className="mt-0"><OrcadoRealizadoTab /></TabsContent>
          <TabsContent value="fechamento" className="mt-0"><FechamentoPeriodoTab /></TabsContent>
        </Tabs>
      </div>

      {/* Dialog: Nova/Editar Conta a Pagar */}
      <Dialog open={dialogDespesaAberto} onOpenChange={setDialogDespesaAberto}>
        <DialogContent className="max-w-2xl max-h-[94vh] overflow-hidden p-0 gap-0">
          <DialogHeader className="space-y-0.5 p-4 sm:p-5 pb-3 border-b">
            <DialogTitle className="text-base">{modoDespesa === "novo" ? "Nova Conta a Pagar" : "Editar Conta a Pagar"}</DialogTitle>
            <DialogDescription className="text-xs leading-snug">
              Deixe "Loteamento" em branco para lançar como conta administrativa da empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Descrição *</Label>
                <Input value={formDespesa.descricao} onChange={(e) => setFormDespesa((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Terraplanagem — Quadra B" />
                {tentouSalvarDespesa && !formDespesa.descricao.trim() ? <p className="text-xs text-destructive mt-1">Informe a descrição.</p> : null}
              </div>
              <div className={ratearDespesa && modoDespesa === "novo" ? "sm:col-span-2" : ""}>
                <div className="flex items-center justify-between gap-2">
                  <Label>{ratearDespesa ? "Rateio por loteamento" : "Loteamento (opcional)"}</Label>
                  {modoDespesa === "novo" && (
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={ratearDespesa}
                        onCheckedChange={(v) => {
                          setRatearDespesa(v);
                          if (v) {
                            setFormDespesa((f) => ({ ...f, id_loteamento: "" }));
                            if (rateioDespesa.length === 0) setRateioDespesa([{ id_loteamento: "", percentual: "100" }]);
                          }
                        }}
                      />
                      <span className="text-xs text-muted-foreground">Ratear entre loteamentos</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72 text-xs">
                          Use quando a despesa pertence a mais de um loteamento ao mesmo tempo
                          (ex: energia que atende vários empreendimentos). Informe o percentual de
                          cada um — a soma precisa fechar em 100%.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
                {ratearDespesa && modoDespesa === "novo" ? (
                  <RateioLoteamentoEditor loteamentos={loteamentos} value={rateioDespesa} onChange={setRateioDespesa} />
                ) : (
                  <Combobox
                    options={loteamentoOptions}
                    value={formDespesa.id_loteamento || "none"}
                    onValueChange={(v) => setFormDespesa((f) => ({ ...f, id_loteamento: v === "none" ? "" : v }))}
                    placeholder="— Administrativa —"
                    searchPlaceholder="Buscar loteamento..."
                    emptyText="Nenhum loteamento encontrado."
                  />
                )}
              </div>
              <div>
                <Label>Categoria *</Label>
                <Combobox
                  options={categoriaOptions}
                  value={formDespesa.id_categoria}
                  onValueChange={(v) => setFormDespesa((f) => ({ ...f, id_categoria: v }))}
                  placeholder="Selecione…"
                  searchPlaceholder="Buscar categoria..."
                  emptyText="Nenhuma categoria encontrada."
                />
                {tentouSalvarDespesa && !formDespesa.id_categoria ? <p className="text-xs text-destructive mt-1">Selecione uma categoria.</p> : null}
              </div>
              <div>
                <Label>Fornecedor (opcional)</Label>
                <Combobox
                  options={fornecedorOptions}
                  value={formDespesa.id_fornecedor || "none"}
                  onValueChange={(v) => setFormDespesa((f) => ({ ...f, id_fornecedor: v === "none" ? "" : v }))}
                  placeholder="— Nenhum —"
                  searchPlaceholder="Buscar fornecedor..."
                  emptyText="Nenhum fornecedor encontrado."
                />
              </div>
              <div>
                <Label>Valor Total *</Label>
                <MoneyInput value={formDespesa.valor_total} onValueChange={(valor_total) => setFormDespesa((f) => ({ ...f, valor_total }))} />
                {tentouSalvarDespesa && !formDespesa.valor_total ? <p className="text-xs text-destructive mt-1">Informe um valor maior que zero.</p> : null}
              </div>
              {modoDespesa === "novo" && (
                <>
                  <div className="sm:col-span-2 flex items-center gap-2.5 rounded-lg border p-2 bg-muted/30">
                    <Switch
                      checked={formDespesa.recorrente}
                      onCheckedChange={(checked) =>
                        setFormDespesa((f) => ({ ...f, recorrente: checked, numero_parcelas: checked ? "1" : f.numero_parcelas }))
                      }
                    />
                    <Label
                      className="cursor-pointer flex-1"
                      onClick={() => setFormDespesa((f) => ({ ...f, recorrente: !f.recorrente, numero_parcelas: !f.recorrente ? "1" : f.numero_parcelas }))}
                    >
                      Conta recorrente (todo mês)
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72 text-xs">
                        Quando ativado, o sistema gera automaticamente uma nova parcela todo mês
                        (mesmo valor, um mês após a anterior) — ideal para contas fixas como
                        energia, internet ou aluguel. Você pode pausar ou reativar a qualquer
                        momento na tela de detalhes da conta.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {!formDespesa.recorrente && (
                    <div>
                      <Label>Número de Parcelas</Label>
                      <Input type="number" min="1" max="60" value={formDespesa.numero_parcelas} onChange={(e) => setFormDespesa((f) => ({ ...f, numero_parcelas: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <Label>{formDespesa.recorrente ? "Vencimento (1ª parcela)" : "1º Vencimento"}</Label>
                    <Input type="date" value={formDespesa.data_primeiro_vencimento} onChange={(e) => setFormDespesa((f) => ({ ...f, data_primeiro_vencimento: e.target.value }))} />
                  </div>
                </>
              )}
              <div>
                <Label>Nº da NF / Documento</Label>
                <Input value={formDespesa.documento} onChange={(e) => setFormDespesa((f) => ({ ...f, documento: e.target.value }))} />
              </div>
              <div>
                <Label className="flex items-center justify-between gap-2">
                  <span>Comprovante / NF (anexo)</span>
                  {formDespesa.anexo_nome && (
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="text-[11px] font-normal text-muted-foreground truncate max-w-[110px]">{formDespesa.anexo_nome}</span>
                      <button
                        type="button"
                        onClick={abrirPreviewAnexo}
                        disabled={carregandoAnexo}
                        title="Visualizar anexo"
                        className="shrink-0 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        {carregandoAnexo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </span>
                  )}
                </Label>
                <Input type="file" accept="image/*,application/pdf" onChange={handleAnexoChange} className="text-sm file:text-xs" />
              </div>
              <div className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={formDespesa.observacoes} onChange={(e) => setFormDespesa((f) => ({ ...f, observacoes: e.target.value }))} />
              </div>
              {modoDespesa === "novo" && previewParcelas.length > 0 ? (
                <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-semibold mb-2">Prévia das parcelas</p>
                  <div className="grid sm:grid-cols-2 gap-1 text-xs">
                    {previewParcelas.slice(0, 6).map((parcela) => (
                      <div key={parcela.numero} className="flex justify-between gap-3"><span>Parcela {parcela.numero} · {formatDateBR(parcela.vencimento)}</span><strong>{fmtMoeda(parcela.valor)}</strong></div>
                    ))}
                  </div>
                  {previewParcelas.length > 6 ? <p className="text-xs text-muted-foreground mt-2">Mais {previewParcelas.length - 6} parcela(s) seguirão o mesmo intervalo mensal.</p> : null}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 border-t bg-background p-4 sm:px-5 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            <Button variant="outline" onClick={() => setDialogDespesaAberto(false)}>Cancelar</Button>
            <Button
              disabled={salvarDespesaMutation.isPending}
              onClick={() => {
                setTentouSalvarDespesa(true);
                if (!formDespesa.descricao.trim() || !formDespesa.id_categoria || !formDespesa.valor_total || !rateioDespesaValido) return;
                salvarDespesaMutation.mutate();
              }}
            >
              {salvarDespesaMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Preview do anexo */}
      <Dialog open={dialogAnexoAberto} onOpenChange={setDialogAnexoAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate">{formDespesa.anexo_nome || "Anexo"}</DialogTitle>
          </DialogHeader>
          {formDespesa.anexo_base64 ? (
            formDespesa.anexo_base64.startsWith("data:application/pdf") ? (
              <iframe src={formDespesa.anexo_base64} title="Anexo" className="w-full h-[70vh] rounded-md border" />
            ) : (
              <img src={formDespesa.anexo_base64} alt={formDespesa.anexo_nome || "Anexo"} className="w-full max-h-[70vh] object-contain rounded-md border" />
            )
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Não foi possível carregar o anexo.</p>
          )}
          <DialogFooter>
            {formDespesa.anexo_base64 && (
              <a href={formDespesa.anexo_base64} download={formDespesa.anexo_nome || "anexo"} className="inline-flex">
                <Button type="button" variant="outline">Baixar</Button>
              </a>
            )}
            <Button variant="outline" onClick={() => setDialogAnexoAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhe da despesa + parcelas */}
      <Dialog open={dialogDetalheAberto} onOpenChange={(o) => { setDialogDetalheAberto(o); if (!o) setDespesaSelecionadaId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{despesaDetalhe?.descricao}</DialogTitle>
            <DialogDescription>
              {despesaDetalhe?.loteamento_nome ?? "Conta a pagar administrativa"} · {despesaDetalhe ? fmtMoeda(despesaDetalhe.valor_total) : ""}
            </DialogDescription>
          </DialogHeader>
          {isLoadingDetalhe ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
          ) : (
            <>
              {despesaDetalhe?.recorrente && (
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Repeat className={cn("h-4 w-4", despesaDetalhe.recorrencia_ativa ? "text-emerald-600" : "text-muted-foreground")} />
                    <div>
                      <p className="text-sm font-medium">Conta recorrente</p>
                      <p className="text-xs text-muted-foreground">
                        {despesaDetalhe.recorrencia_ativa
                          ? "Uma nova parcela é gerada automaticamente todo mês."
                          : "Geração automática pausada — nenhuma parcela nova será criada."}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={despesaDetalhe.recorrencia_ativa}
                    disabled={toggleRecorrenciaMutation.isPending}
                    onCheckedChange={(checked) => toggleRecorrenciaMutation.mutate({ id: despesaDetalhe.id_despesa, ativa: checked })}
                  />
                </div>
              )}
              {despesaDetalhe?.rateio && despesaDetalhe.rateio.length > 0 && (
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <Split className="h-4 w-4 text-sky-600" /> Rateada entre {despesaDetalhe.rateio.length} loteamentos
                  </p>
                  <div className="space-y-1">
                    {despesaDetalhe.rateio.map((r) => (
                      <div key={r.id_loteamento} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{r.loteamento_nome}</span>
                        <span className="font-medium">{Number(r.percentual)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-3 py-2 text-left font-semibold">Parcela</th>
                    <th className="px-3 py-2 text-left font-semibold">Vencimento</th>
                    <th className="px-3 py-2 text-left font-semibold">Valor</th>
                    <th className="px-3 py-2 text-left font-semibold">Situação</th>
                    <th className="px-3 py-2 text-left font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {despesaDetalhe?.parcelas.map((p) => (
                    <tr key={p.id_despesa_parcela} className="border-b last:border-0">
                      <td className="px-3 py-2">{rotuloParcela(p.numero_parcela, despesaDetalhe.parcelas.length, despesaDetalhe.recorrente)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDateBR(p.vencimento)}</td>
                      <td className="px-3 py-2 font-medium">{fmtMoeda(p.valor)}</td>
                      <td className="px-3 py-2">
                        {p.situacao === "pago" ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">Paga em {formatDateBR(p.pago_data)}</Badge>
                        ) : p.situacao === "parcial" ? (
                          <div><Badge variant="secondary">Parcial · {fmtMoeda(p.valor_pago)}</Badge><div className="text-xs text-muted-foreground mt-1">Saldo: {fmtMoeda(Math.max(0,Number(p.valor)-Number(p.valor_pago??0)+Number(p.multa_paga??0)+Number(p.juros_pagos??0)-Number(p.desconto_obtido??0)-Number(p.iss_retido??0)-Number(p.irrf_retido??0)-Number(p.inss_retido??0)))}</div></div>
                        ) : (
                          <Badge variant="outline">Em aberto</Badge>
                        )}
                        {Number(p.iss_retido??0)+Number(p.irrf_retido??0)+Number(p.inss_retido??0)>0 ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Retido: {fmtMoeda(Number(p.iss_retido??0)+Number(p.irrf_retido??0)+Number(p.inss_retido??0))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col items-start gap-1">
                          {p.situacao === "pago" ? (
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setParcelaParaEstorno(p)}>
                              <RotateCcw className="h-3.5 w-3.5" /> Estornar
                            </Button>
                          ) : (
                            <div className="flex gap-1"><Button size="sm" className="gap-1.5" onClick={() => abrirPagarParcela(p)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                            </Button>{p.situacao==="parcial"?<Button size="sm" variant="outline" onClick={()=>setParcelaParaEstorno(p)}><RotateCcw className="h-3.5 w-3.5"/> Estornar baixas</Button>:null}</div>
                          )}
                          {p.pagamentos?.filter((pagamento) => pagamento.anexo_base64).map((pagamento) => (
                            <a key={pagamento.id_parcela_pagamento} href={pagamento.anexo_base64!} download={pagamento.anexo_nome || "comprovante"} className="flex max-w-40 items-center gap-1 truncate text-xs text-primary hover:underline">
                              <Paperclip className="h-3 w-3 shrink-0" /> {pagamento.anexo_nome || "Comprovante"}
                            </a>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDetalheAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Pagar parcela */}
      <Dialog open={dialogPagarAberto} onOpenChange={setDialogPagarAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagar parcela {parcelaSelecionada?.numero_parcela}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data do pagamento</Label>
              <Input type="date" value={formPagar.pago_data} onChange={(event) => { const data=event.target.value,e=encargosSugeridos(Number(formPagar.valor_base),parcelaSelecionada?.vencimento??null,data,empresaRelatorio);setFormPagar(f=>({...f,pago_data:data,multa:String(e.multa),juros:String(e.juros)})); }} />
            </div>
            <div>
              <Label>Valor original</Label><MoneyInput value={formPagar.valor_base} onValueChange={(valor_base) => setFormPagar((f) => ({ ...f, valor_base }))} />
            </div>
            <div className="grid grid-cols-3 gap-2"><div><Label>Multa</Label><MoneyInput value={formPagar.multa} onValueChange={(multa)=>setFormPagar(f=>({...f,multa}))}/></div><div><Label>Juros</Label><MoneyInput value={formPagar.juros} onValueChange={(juros)=>setFormPagar(f=>({...f,juros}))}/></div><div><Label>Desconto</Label><MoneyInput value={formPagar.desconto} onValueChange={(desconto)=>setFormPagar(f=>({...f,desconto}))}/></div></div>
            <div>
              <Label>Retenções do serviço</Label>
              <div className="mt-1 grid grid-cols-3 gap-2"><div><Label className="text-xs text-muted-foreground">ISS</Label><MoneyInput value={formPagar.iss_retido} onValueChange={(iss_retido)=>setFormPagar(f=>({...f,iss_retido}))}/></div><div><Label className="text-xs text-muted-foreground">IRRF</Label><MoneyInput value={formPagar.irrf_retido} onValueChange={(irrf_retido)=>setFormPagar(f=>({...f,irrf_retido}))}/></div><div><Label className="text-xs text-muted-foreground">INSS</Label><MoneyInput value={formPagar.inss_retido} onValueChange={(inss_retido)=>setFormPagar(f=>({...f,inss_retido}))}/></div></div>
              <p className="mt-1 text-xs text-muted-foreground">As retenções reduzem a saída da conta, sem reduzir o valor bruto liquidado.</p>
            </div>
            <div className="rounded-md bg-muted p-3 flex justify-between"><span className="text-sm text-muted-foreground">Total líquido a pagar</span><strong>{fmtMoeda(Number(formPagar.valor_base||0)+Number(formPagar.multa||0)+Number(formPagar.juros||0)-Number(formPagar.desconto||0)-Number(formPagar.iss_retido||0)-Number(formPagar.irrf_retido||0)-Number(formPagar.inss_retido||0))}</strong></div>
            <div>
              <Label>Conta / local do pagamento *</Label>
              <Combobox
                options={contaOptions}
                value={formPagar.id_conta}
                onValueChange={(v) => setFormPagar((f) => ({ ...f, id_conta: v }))}
                placeholder="Selecione de onde saiu o pagamento…"
                searchPlaceholder="Buscar conta..."
                emptyText="Nenhuma conta encontrada."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Obrigatório — é o que faz esse pagamento aparecer no extrato da conta.
              </p>
            </div>
            <ComprovanteInput
              value={{ anexo_nome: formPagar.anexo_nome, anexo_base64: formPagar.anexo_base64 }}
              onChange={(anexo) => setFormPagar((atual) => ({ ...atual, ...anexo }))}
              onError={(message) => toast({ title: message, variant: "destructive" })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPagarAberto(false)}>Cancelar</Button>
            <Button disabled={pagarParcelaMutation.isPending || !formPagar.valor_base || !formPagar.id_conta} onClick={() => pagarParcelaMutation.mutate()}>
              {pagarParcelaMutation.isPending ? "Salvando…" : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Pagar em lote */}
      <Dialog open={dialogPagarLoteAberto} onOpenChange={setDialogPagarLoteAberto}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagar {despesasSelecionadasParaPagar.length} conta(s) selecionada(s)</DialogTitle>
            <DialogDescription>
              Cada uma será quitada na próxima parcela em aberto. Ajuste o valor se necessário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data do pagamento</Label>
                <Input type="date" value={formPagarLote.pago_data} onChange={(e) => setFormPagarLote((f) => ({ ...f, pago_data: e.target.value }))} />
              </div>
              <div>
                <Label>Conta / local do pagamento *</Label>
                <Combobox
                  options={contaOptions}
                  value={formPagarLote.id_conta}
                  onValueChange={(v) => setFormPagarLote((f) => ({ ...f, id_conta: v }))}
                  placeholder="Selecione…"
                  searchPlaceholder="Buscar conta..."
                  emptyText="Nenhuma conta encontrada."
                />
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                    <th className="px-3 py-2 text-left font-semibold">Vencimento</th>
                    <th className="px-3 py-2 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {despesasSelecionadasParaPagar.map((d) => (
                    <tr key={d.id_despesa} className="border-b last:border-0">
                      <td className="px-3 py-2">{d.descricao}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{d.vencimento ? formatDateBR(d.vencimento) : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <MoneyInput
                          className="w-28 h-8 text-right ml-auto"
                          value={valoresLote[d.id_despesa] ?? d.proxima_parcela_valor ?? d.valor_total}
                          onValueChange={(value) => setValoresLote((v) => ({ ...v, [d.id_despesa]: value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end text-sm">
              <span className="text-muted-foreground mr-2">Total:</span>
              <span className="font-semibold">{fmtMoeda(totalSelecionadoLote)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPagarLoteAberto(false)}>Cancelar</Button>
            <Button
              disabled={pagarLoteMutation.isPending || !formPagarLote.id_conta || despesasSelecionadasParaPagar.length === 0}
              onClick={() => pagarLoteMutation.mutate()}
            >
              {pagarLoteMutation.isPending ? "Pagando…" : `Confirmar pagamento (${despesasSelecionadasParaPagar.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova/Editar Conta do Plano de Contas */}
      <Dialog open={dialogCategoriaAberto} onOpenChange={setDialogCategoriaAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {categoriaEditandoId ? "Editar Conta" : categoriaPaiId ? "Nova Sub-conta" : "Nova Conta Raiz"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={formCategoria.nome} onChange={(e) => setFormCategoria((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            {!categoriaEditandoId && !categoriaPaiId && (
              <div>
                <Label>Tipo</Label>
                <Select value={formCategoria.tipo} onValueChange={(v: "receita" | "despesa") => setFormCategoria((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCategoriaAberto(false)}>Cancelar</Button>
            <Button disabled={salvarCategoriaMutation.isPending || !formCategoria.nome.trim()} onClick={() => salvarCategoriaMutation.mutate()}>
              {salvarCategoriaMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Novo/Editar Fornecedor */}
      <Dialog open={dialogFornecedorAberto} onOpenChange={setDialogFornecedorAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{fornecedorEditandoId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={formFornecedor.nome} onChange={(e) => setFormFornecedor((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF/CNPJ</Label>
                <Input value={formFornecedor.documento} onChange={(e) => setFormFornecedor((f) => ({ ...f, documento: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={formFornecedor.telefone} onChange={(e) => setFormFornecedor((f) => ({ ...f, telefone: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={formFornecedor.email} onChange={(e) => setFormFornecedor((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Pessoa de contato</Label>
              <Input value={formFornecedor.contato} onChange={(e) => setFormFornecedor((f) => ({ ...f, contato: e.target.value }))} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={formFornecedor.observacoes} onChange={(e) => setFormFornecedor((f) => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFornecedorAberto(false)}>Cancelar</Button>
            <Button disabled={salvarFornecedorMutation.isPending || !formFornecedor.nome.trim()} onClick={() => salvarFornecedorMutation.mutate()}>
              {salvarFornecedorMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DestructiveConfirmationDialog
        open={dialogExcluirDespesa.aberto}
        onOpenChange={(open) => !open && setDialogExcluirDespesa({ aberto: false, despesa: null })}
        title="Excluir conta a pagar?"
        description={dialogExcluirDespesa.despesa ? `${dialogExcluirDespesa.despesa.descricao} · ${fmtMoeda(dialogExcluirDespesa.despesa.valor_total)}` : "Conta selecionada"}
        consequence="A conta e suas parcelas serão removidas permanentemente. A exclusão só será aceita se nenhuma parcela estiver paga."
        confirmLabel="Excluir conta"
        pending={excluirDespesaMutation.isPending}
        onConfirm={() => {
          if (dialogExcluirDespesa.despesa) excluirDespesaMutation.mutate(dialogExcluirDespesa.despesa.id_despesa);
        }}
      />
      <DestructiveConfirmationDialog
        open={Boolean(parcelaParaEstorno)}
        onOpenChange={(open) => !open && setParcelaParaEstorno(null)}
        title="Estornar pagamento?"
        description={parcelaParaEstorno && despesaDetalhe ? `${despesaDetalhe.descricao} · parcela ${parcelaParaEstorno.numero_parcela} · ${fmtMoeda(parcelaParaEstorno.valor_pago ?? parcelaParaEstorno.valor)} · paga em ${formatDateBR(parcelaParaEstorno.pago_data)}` : "Parcela selecionada"}
        consequence="A parcela voltará para Em Aberto, o valor pago será apagado e a saída deixará de compor o extrato da conta."
        confirmLabel="Estornar pagamento"
        pending={estornarParcelaMutation.isPending}
        onConfirm={() => parcelaParaEstorno && estornarParcelaMutation.mutate(parcelaParaEstorno.id_despesa_parcela)}
      />
      <DestructiveConfirmationDialog
        open={Boolean(cadastroDestrutivo)}
        onOpenChange={(open) => !open && setCadastroDestrutivo(null)}
        title={`${cadastroDestrutivo?.acao === "excluir" ? "Excluir" : "Desativar"} ${cadastroDestrutivo?.tipo === "categoria" ? "conta contábil" : "fornecedor"}?`}
        description={cadastroDestrutivo?.nome ?? "Cadastro selecionado"}
        consequence={cadastroDestrutivo?.acao === "excluir" ? "O cadastro será removido permanentemente se não possuir vínculos." : "O cadastro deixará de aparecer para seleção em novos lançamentos."}
        confirmLabel={cadastroDestrutivo?.acao === "excluir" ? "Excluir" : "Desativar"}
        pending={toggleCategoriaMutation.isPending || excluirCategoriaMutation.isPending || toggleFornecedorMutation.isPending || excluirFornecedorMutation.isPending}
        onConfirm={() => {
          if (!cadastroDestrutivo) return;
          if (cadastroDestrutivo.tipo === "categoria") {
            if (cadastroDestrutivo.acao === "excluir") excluirCategoriaMutation.mutate(cadastroDestrutivo.id, { onSuccess: () => setCadastroDestrutivo(null) });
            else toggleCategoriaMutation.mutate({ id: cadastroDestrutivo.id, ativo: false }, { onSuccess: () => setCadastroDestrutivo(null) });
          } else if (cadastroDestrutivo.acao === "excluir") excluirFornecedorMutation.mutate(cadastroDestrutivo.id, { onSuccess: () => setCadastroDestrutivo(null) });
          else toggleFornecedorMutation.mutate({ id: cadastroDestrutivo.id, ativo: false }, { onSuccess: () => setCadastroDestrutivo(null) });
        }}
      />
    </AppLayout>
  );
}
