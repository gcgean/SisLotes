import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatDateBR } from "@/lib/date-br";
import { VisaoGeralTab } from "@/components/financeiro/VisaoGeralTab";
import { ContasTab } from "@/components/financeiro/ContasTab";
import { LancamentosTab } from "@/components/financeiro/LancamentosTab";
import {
  Plus,
  Receipt,
  Pencil,
  Trash2,
  Paperclip,
  CheckCircle2,
  RotateCcw,
  Search,
  Building2,
  LayoutDashboard,
  ReceiptText,
  ListTree,
  Truck,
  Landmark,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface DespesaParcela {
  id_despesa_parcela: number;
  numero_parcela: number;
  vencimento: string;
  valor: string;
  situacao: "aberto" | "pago";
  pago_data: string | null;
  valor_pago: string | null;
  id_conta: number | null;
}

interface DespesaDetalhe extends DespesaResumo {
  parcelas: DespesaParcela[];
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
};

const emptyCategoriaForm = { nome: "", tipo: "despesa" as "receita" | "despesa" };
const emptyFornecedorForm = { nome: "", documento: "", telefone: "", email: "", contato: "", observacoes: "" };

const MENU_FINANCEIRO = [
  { value: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { value: "despesas", label: "Despesas", icon: ReceiptText },
  { value: "categorias", label: "Plano de Contas", icon: ListTree },
  { value: "fornecedores", label: "Fornecedores", icon: Truck },
  { value: "contas", label: "Contas", icon: Landmark },
  { value: "lancamentos", label: "Lançamentos", icon: ScrollText },
] as const;

// ═══════════════════════════════════════════════════════════════════════════

export default function Despesas() {
  const queryClient = useQueryClient();

  // ─── Filtros da lista de despesas ────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filtroLoteamento, setFiltroLoteamento] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroSituacao, setFiltroSituacao] = useState<string>("todas");

  // ─── Dialogs: despesa ─────────────────────────────────────────────────────
  const [dialogDespesaAberto, setDialogDespesaAberto] = useState(false);
  const [modoDespesa, setModoDespesa] = useState<"novo" | "editar">("novo");
  const [despesaEditandoId, setDespesaEditandoId] = useState<number | null>(null);
  const [formDespesa, setFormDespesa] = useState(emptyDespesaForm);
  const [dialogDetalheAberto, setDialogDetalheAberto] = useState(false);
  const [despesaSelecionadaId, setDespesaSelecionadaId] = useState<number | null>(null);
  const [dialogExcluirDespesa, setDialogExcluirDespesa] = useState<{ aberto: boolean; id: number | null }>({ aberto: false, id: null });

  // ─── Dialog: pagar parcela ────────────────────────────────────────────────
  const [dialogPagarAberto, setDialogPagarAberto] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<DespesaParcela | null>(null);
  const [formPagar, setFormPagar] = useState({ pago_data: new Date().toISOString().slice(0, 10), valor_pago: "", id_conta: "" });

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
      if (!r.ok) throw new Error("Erro ao carregar despesas");
      return r.json();
    },
  });

  const { data: despesaDetalhe, isLoading: isLoadingDetalhe } = useQuery<DespesaDetalhe>({
    queryKey: ["despesa-detalhe", despesaSelecionadaId],
    enabled: despesaSelecionadaId != null && dialogDetalheAberto,
    queryFn: async () => {
      const r = await fetch(`/api/despesas/${despesaSelecionadaId}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar detalhe da despesa");
      return r.json();
    },
  });

  useEffect(() => {
    if (erroDespesas) toast({ title: "Erro ao carregar despesas", description: erroDespesasMsg instanceof Error ? erroDespesasMsg.message : undefined, variant: "destructive" });
  }, [erroDespesas, erroDespesasMsg]);
  useEffect(() => {
    if (erroCategorias) toast({ title: "Erro ao carregar categorias", description: erroCategoriasMsg instanceof Error ? erroCategoriasMsg.message : undefined, variant: "destructive" });
  }, [erroCategorias, erroCategoriasMsg]);
  useEffect(() => {
    if (erroFornecedores) toast({ title: "Erro ao carregar fornecedores", description: erroFornecedoresMsg instanceof Error ? erroFornecedoresMsg.message : undefined, variant: "destructive" });
  }, [erroFornecedores, erroFornecedoresMsg]);

  const categoriasAtivas = categorias.filter((c) => c.ativo && c.tipo === "despesa");
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

  const despesasFiltradas = despesas.filter((d) => {
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

  // ─── Mutations: despesa ───────────────────────────────────────────────────
  const salvarDespesaMutation = useMutation({
    mutationFn: async () => {
      const isEdicao = modoDespesa === "editar" && despesaEditandoId;
      const body: Record<string, unknown> = {
        id_loteamento: formDespesa.id_loteamento ? Number(formDespesa.id_loteamento) : null,
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
        body.numero_parcelas = Number(formDespesa.numero_parcelas) || 1;
        body.data_primeiro_vencimento = formDespesa.data_primeiro_vencimento;
      }

      const url = isEdicao ? `/api/despesas/${despesaEditandoId}` : "/api/despesas";
      const r = await fetch(url, { method: isEdicao ? "PUT" : "POST", headers, body: JSON.stringify(body) });
      const data = await parseJson(r);
      if (!r.ok) throw new Error(extractError(data, "Erro ao salvar despesa"));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      setDialogDespesaAberto(false);
      setFormDespesa(emptyDespesaForm);
      toast({ title: modoDespesa === "novo" ? "Despesa cadastrada" : "Despesa atualizada" });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar despesa", description: e.message, variant: "destructive" }),
  });

  const excluirDespesaMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/despesas/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!r.ok) {
        const data = await parseJson(r);
        throw new Error(extractError(data, "Erro ao excluir despesa"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      toast({ title: "Despesa excluída" });
    },
    onError: (e: Error) => toast({ title: "Não foi possível excluir", description: e.message, variant: "destructive" }),
  });

  const pagarParcelaMutation = useMutation({
    mutationFn: async () => {
      if (!parcelaSelecionada) throw new Error("Parcela não selecionada");
      const body = {
        pago_data: formPagar.pago_data,
        valor_pago: Number(formPagar.valor_pago),
        id_conta: formPagar.id_conta ? Number(formPagar.id_conta) : null,
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
      queryClient.invalidateQueries({ queryKey: ["despesa-detalhe", despesaSelecionadaId] });
      setDialogPagarAberto(false);
      toast({ title: "Parcela paga com sucesso" });
    },
    onError: (e: Error) => toast({ title: "Erro ao pagar parcela", description: e.message, variant: "destructive" }),
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
      queryClient.invalidateQueries({ queryKey: ["despesa-detalhe", despesaSelecionadaId] });
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
    setDialogDespesaAberto(true);
  }

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
    });
    setDialogDespesaAberto(true);
  }

  function abrirDetalheDespesa(id: number) {
    setDespesaSelecionadaId(id);
    setDialogDetalheAberto(true);
  }

  function abrirPagarParcela(parcela: DespesaParcela) {
    setParcelaSelecionada(parcela);
    setFormPagar({ pago_data: new Date().toISOString().slice(0, 10), valor_pago: parcela.valor, id_conta: "" });
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

        <Tabs defaultValue="visao-geral" orientation="vertical" className="flex flex-col md:flex-row gap-6 items-start">
          <TabsList className="h-auto md:sticky md:top-4 w-full md:w-56 shrink-0 flex-row md:flex-col items-stretch justify-start gap-1 bg-transparent p-0 overflow-x-auto md:overflow-visible">
            {MENU_FINANCEIRO.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "w-full justify-start gap-2.5 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shrink-0",
                  "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/20 data-[state=active]:shadow-none",
                  "hover:bg-muted/60 hover:text-foreground transition-colors"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 min-w-0 w-full">
          <TabsContent value="visao-geral" className="mt-0">
            <VisaoGeralTab />
          </TabsContent>

          {/* ─── Aba Despesas ─────────────────────────────────────────────── */}
          <TabsContent value="despesas" className="mt-0 space-y-4">
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
              <Button size="sm" className="gap-2" onClick={abrirNovaDespesa}>
                <Plus className="h-4 w-4" /> Nova Despesa
              </Button>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                    <th className="px-4 py-3 text-left font-semibold">Loteamento</th>
                    <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold">Fornecedor</th>
                    <th className="px-4 py-3 text-left font-semibold">Valor</th>
                    <th className="px-4 py-3 text-left font-semibold">Parcelas</th>
                    <th className="px-4 py-3 text-left font-semibold">Situação</th>
                    <th className="px-4 py-3 text-left font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingDespesas ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
                  ) : despesasFiltradas.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhuma despesa encontrada.</td></tr>
                  ) : (
                    despesasFiltradas.map((d) => {
                      const situacao = d.parcelas_pagas === d.parcelas_total ? "pago" : d.parcelas_pagas === 0 ? "aberto" : "parcial";
                      return (
                        <tr key={d.id_despesa} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => abrirDetalheDespesa(d.id_despesa)}>
                          <td className="px-4 py-3">
                            <div className="font-medium flex items-center gap-1.5">
                              {d.descricao}
                              {d.anexo_nome && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                            </div>
                            {d.documento && <div className="text-xs text-muted-foreground">NF: {d.documento}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {d.loteamento_nome ? (
                              <span className="flex items-center gap-1"><Building2 className="h-3 w-3 text-muted-foreground" />{d.loteamento_nome}</span>
                            ) : (
                              <Badge variant="secondary">Administrativa</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{d.categoria_nome ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{d.fornecedor_nome ?? "—"}</td>
                          <td className="px-4 py-3 font-medium">{fmtMoeda(d.valor_total)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{d.parcelas_pagas}/{d.parcelas_total}</td>
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
                                onClick={() => setDialogExcluirDespesa({ aberto: true, id: d.id_despesa })}
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
                            <Button size="sm" variant="outline" onClick={() => toggleCategoriaMutation.mutate({ id: c.id_conta_contabil, ativo: !c.ativo })}>
                              {c.ativo ? "Desativar" : "Ativar"}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEditarCategoria(c)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => excluirCategoriaMutation.mutate(c.id_conta_contabil)}>
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
                            <Button size="sm" variant="outline" onClick={() => toggleFornecedorMutation.mutate({ id: f.id_fornecedor, ativo: !f.ativo })}>
                              {f.ativo ? "Desativar" : "Ativar"}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEditarFornecedor(f)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => excluirFornecedorMutation.mutate(f.id_fornecedor)}>
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
          </div>
        </Tabs>
      </div>

      {/* Dialog: Nova/Editar Despesa */}
      <Dialog open={dialogDespesaAberto} onOpenChange={setDialogDespesaAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modoDespesa === "novo" ? "Nova Despesa" : "Editar Despesa"}</DialogTitle>
            <DialogDescription>
              Deixe "Loteamento" em branco para lançar como despesa administrativa da empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Descrição *</Label>
                <Input value={formDespesa.descricao} onChange={(e) => setFormDespesa((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Terraplanagem — Quadra B" />
              </div>
              <div>
                <Label>Loteamento (opcional)</Label>
                <Select value={formDespesa.id_loteamento || "none"} onValueChange={(v) => setFormDespesa((f) => ({ ...f, id_loteamento: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="— Administrativa —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Administrativa —</SelectItem>
                    {loteamentos.map((l) => (
                      <SelectItem key={l.id_loteamento} value={String(l.id_loteamento)}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria *</Label>
                <Select value={formDespesa.id_categoria} onValueChange={(v) => setFormDespesa((f) => ({ ...f, id_categoria: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {categoriasAtivas
                      .slice()
                      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
                      .map((c) => (
                        <SelectItem key={c.id_conta_contabil} value={String(c.id_conta_contabil)}>
                          {"  ".repeat(planoContaDepth(c))}{planoContaLabel(c)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fornecedor (opcional)</Label>
                <Select value={formDespesa.id_fornecedor || "none"} onValueChange={(v) => setFormDespesa((f) => ({ ...f, id_fornecedor: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="— Nenhum —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {fornecedoresAtivos.map((f) => (
                      <SelectItem key={f.id_fornecedor} value={String(f.id_fornecedor)}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Total *</Label>
                <Input type="number" step="0.01" min="0.01" value={formDespesa.valor_total} onChange={(e) => setFormDespesa((f) => ({ ...f, valor_total: e.target.value }))} />
              </div>
              {modoDespesa === "novo" && (
                <>
                  <div>
                    <Label>Número de Parcelas</Label>
                    <Input type="number" min="1" max="60" value={formDespesa.numero_parcelas} onChange={(e) => setFormDespesa((f) => ({ ...f, numero_parcelas: e.target.value }))} />
                  </div>
                  <div>
                    <Label>1º Vencimento</Label>
                    <Input type="date" value={formDespesa.data_primeiro_vencimento} onChange={(e) => setFormDespesa((f) => ({ ...f, data_primeiro_vencimento: e.target.value }))} />
                  </div>
                </>
              )}
              <div>
                <Label>Nº da NF / Documento</Label>
                <Input value={formDespesa.documento} onChange={(e) => setFormDespesa((f) => ({ ...f, documento: e.target.value }))} />
              </div>
              <div>
                <Label>Comprovante / NF (anexo)</Label>
                <Input type="file" accept="image/*,application/pdf" onChange={handleAnexoChange} />
                {formDespesa.anexo_nome && <p className="text-xs text-muted-foreground mt-1">{formDespesa.anexo_nome}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={formDespesa.observacoes} onChange={(e) => setFormDespesa((f) => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDespesaAberto(false)}>Cancelar</Button>
            <Button
              disabled={salvarDespesaMutation.isPending || !formDespesa.descricao.trim() || !formDespesa.id_categoria || !formDespesa.valor_total}
              onClick={() => salvarDespesaMutation.mutate()}
            >
              {salvarDespesaMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhe da despesa + parcelas */}
      <Dialog open={dialogDetalheAberto} onOpenChange={(o) => { setDialogDetalheAberto(o); if (!o) setDespesaSelecionadaId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{despesaDetalhe?.descricao}</DialogTitle>
            <DialogDescription>
              {despesaDetalhe?.loteamento_nome ?? "Despesa administrativa"} · {despesaDetalhe ? fmtMoeda(despesaDetalhe.valor_total) : ""}
            </DialogDescription>
          </DialogHeader>
          {isLoadingDetalhe ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
          ) : (
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
                      <td className="px-3 py-2">{p.numero_parcela}/{despesaDetalhe.numero_parcelas}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDateBR(p.vencimento)}</td>
                      <td className="px-3 py-2 font-medium">{fmtMoeda(p.valor)}</td>
                      <td className="px-3 py-2">
                        {p.situacao === "pago" ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">Paga em {formatDateBR(p.pago_data)}</Badge>
                        ) : (
                          <Badge variant="outline">Em aberto</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.situacao === "pago" ? (
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => estornarParcelaMutation.mutate(p.id_despesa_parcela)}>
                            <RotateCcw className="h-3.5 w-3.5" /> Estornar
                          </Button>
                        ) : (
                          <Button size="sm" className="gap-1.5" onClick={() => abrirPagarParcela(p)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <Input type="date" value={formPagar.pago_data} onChange={(e) => setFormPagar((f) => ({ ...f, pago_data: e.target.value }))} />
            </div>
            <div>
              <Label>Valor pago</Label>
              <Input type="number" step="0.01" value={formPagar.valor_pago} onChange={(e) => setFormPagar((f) => ({ ...f, valor_pago: e.target.value }))} />
            </div>
            <div>
              <Label>Conta (opcional)</Label>
              <Select value={formPagar.id_conta || "none"} onValueChange={(v) => setFormPagar((f) => ({ ...f, id_conta: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="— Não informar —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Não informar —</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id_conta} value={String(c.id_conta)}>{c.apelido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPagarAberto(false)}>Cancelar</Button>
            <Button disabled={pagarParcelaMutation.isPending || !formPagar.valor_pago} onClick={() => pagarParcelaMutation.mutate()}>
              {pagarParcelaMutation.isPending ? "Salvando…" : "Confirmar pagamento"}
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

      {/* AlertDialog: excluir despesa */}
      <AlertDialog open={dialogExcluirDespesa.aberto} onOpenChange={(o) => !o && setDialogExcluirDespesa({ aberto: false, id: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Só é permitida se nenhuma parcela já tiver sido paga.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (dialogExcluirDespesa.id) excluirDespesaMutation.mutate(dialogExcluirDespesa.id);
                setDialogExcluirDespesa({ aberto: false, id: null });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
