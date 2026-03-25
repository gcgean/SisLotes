import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ContratoDialog } from "@/components/contratos/ContratoDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, Edit, Trash2, Eye, User, MapPin, Phone,
  CreditCard, ShoppingCart, FileText, FileCheck, Receipt,
  FileSignature, ArrowRightLeft,
} from "lucide-react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

// ─── Constantes ───────────────────────────────────────────────────────────────

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

const ESTADO_CIVIL_LIST = [
  "Solteiro(a)",
  "Casado(a)",
  "Separado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
];

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Cliente {
  id_cliente: number;
  tipo: "f" | "j";
  nome: string;
  razao_social?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  rg?: string | null;
  estado_civil?: string | null;
  conjuge?: string | null;
  profissao?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  complemento?: string | null;
  fone_res?: string | null;
  fone_com?: string | null;
}

interface ListaClientesResponse {
  data: Cliente[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const clienteFormSchema = z.object({
  tipo: z.enum(["f", "j"]),
  nome: z.string().min(1, "Nome é obrigatório"),
  razao_social: z.string().optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  rg: z.string().optional(),
  estado_civil: z.string().optional(),
  conjuge: z.string().optional(),
  profissao: z.string().optional(),
  endereco: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  complemento: z.string().optional(),
  fone_res: z.string().optional(),
  fone_com: z.string().optional(),
});

type ClienteFormValues = z.infer<typeof clienteFormSchema>;

const defaultValues: ClienteFormValues = {
  tipo: "f",
  nome: "",
  razao_social: "",
  cpf: "",
  cnpj: "",
  rg: "",
  estado_civil: "",
  conjuge: "",
  profissao: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  complemento: "",
  fone_res: "",
  fone_com: "",
};

function clienteToFormValues(c: Cliente): ClienteFormValues {
  return {
    tipo: c.tipo,
    nome: c.nome ?? "",
    razao_social: c.razao_social ?? "",
    cpf: c.cpf ?? "",
    cnpj: c.cnpj ?? "",
    rg: c.rg ?? "",
    estado_civil: c.estado_civil ?? "",
    conjuge: c.conjuge ?? "",
    profissao: c.profissao ?? "",
    endereco: c.endereco ?? "",
    bairro: c.bairro ?? "",
    cidade: c.cidade ?? "",
    estado: c.estado ?? "",
    cep: c.cep ?? "",
    complemento: c.complemento ?? "",
    fone_res: c.fone_res ?? "",
    fone_com: c.fone_com ?? "",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function fetchCliente(id: number): Promise<Cliente> {
  const response = await fetch(`/api/clientes/${id}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!response.ok) throw new Error("Erro ao carregar cliente");
  return response.json();
}

// ─── Componente ───────────────────────────────────────────────────────────────

const Clientes = () => {
  const navigate = useNavigate();
  const [contratoDialogAberto, setContratoDialogAberto] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"all" | "f" | "j">("all");
  const [page, setPage] = useState(1);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [modo, setModo] = useState<"create" | "edit" | "view">("create");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogTab, setDialogTab] = useState("dados");
  const [confirmarExclusao, setConfirmarExclusao] = useState<Cliente | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);

  const queryClient = useQueryClient();

  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteFormSchema),
    defaultValues,
  });

  const tipoWatch = form.watch("tipo");
  const isView = modo === "view";

  useEffect(() => { setPage(1); }, [search, filterTipo]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery<ListaClientesResponse>({
    queryKey: ["clientes", { search, filterTipo, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (search) params.set("search", search);
      if (filterTipo !== "all") params.set("tipo", filterTipo);
      const response = await fetch(`/api/clientes?${params.toString()}`, {
        headers: { ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error("Erro ao carregar clientes");
      return response.json();
    },
  });

  const clientes = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const criarClienteMutation = useMutation({
    mutationFn: async (values: ClienteFormValues) => {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(values),
      });
      let data: unknown;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao cadastrar cliente";
        throw new Error(msg);
      }
      return data as Cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setDialogAberto(false);
      toast({ title: "Cliente cadastrado com sucesso" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao cadastrar cliente",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const atualizarClienteMutation = useMutation({
    mutationFn: async (input: { id: number; values: ClienteFormValues }) => {
      const response = await fetch(`/api/clientes/${input.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(input.values),
      });
      let data: unknown;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao atualizar cliente";
        throw new Error(msg);
      }
      return data as Cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setDialogAberto(false);
      toast({ title: "Cliente atualizado com sucesso" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar cliente",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const excluirClienteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/clientes/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error("Erro ao excluir cliente");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Cliente excluído com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir cliente", variant: "destructive" });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function abrirNovoCliente() {
    setModo("create");
    setClienteSelecionado(null);
    setDialogTab("dados");
    form.reset(defaultValues);
    setDialogAberto(true);
  }

  async function abrirEdicao(cliente: Cliente) {
    setModo("edit");
    setClienteSelecionado(cliente);
    setDialogTab("dados");
    form.reset(clienteToFormValues(cliente));
    setDialogAberto(true);
    setLoadingFull(true);
    try {
      const full = await fetchCliente(cliente.id_cliente);
      form.reset(clienteToFormValues(full));
      setClienteSelecionado(full);
    } catch {
      // mantém os dados parciais já carregados
    } finally {
      setLoadingFull(false);
    }
  }

  async function abrirVisualizacao(cliente: Cliente) {
    setModo("view");
    setClienteSelecionado(cliente);
    setDialogTab("dados");
    form.reset(clienteToFormValues(cliente));
    setDialogAberto(true);
    setLoadingFull(true);
    try {
      const full = await fetchCliente(cliente.id_cliente);
      form.reset(clienteToFormValues(full));
      setClienteSelecionado(full);
    } catch {
      // mantém os dados parciais
    } finally {
      setLoadingFull(false);
    }
  }

  function onSubmit(values: ClienteFormValues) {
    if (modo === "edit" && clienteSelecionado) {
      atualizarClienteMutation.mutate({ id: clienteSelecionado.id_cliente, values });
    } else {
      criarClienteMutation.mutate(values);
    }
  }

  const isSaving = criarClienteMutation.isPending || atualizarClienteMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data ? `${data.total} clientes cadastrados` : "Carregando clientes..."}
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={abrirNovoCliente}>
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row md:flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "f", "j"] as const).map((tipo) => (
              <Button
                key={tipo}
                variant={filterTipo === tipo ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterTipo(tipo)}
              >
                {tipo === "all" ? "Todos" : tipo === "f" ? "Pessoa Física" : "Pessoa Jurídica"}
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
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">CPF / CNPJ</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cidade</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Telefone</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-sm text-muted-foreground">
                      Carregando clientes...
                    </td>
                  </tr>
                )}
                {isError && !isLoading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-sm text-destructive">
                      Erro ao carregar clientes
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && clientes.map((cliente) => (
                  <tr key={cliente.id_cliente} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{cliente.nome}</td>
                    <td className="px-5 py-3">
                      <Badge variant={cliente.tipo === "f" ? "secondary" : "outline"}>
                        {cliente.tipo === "f" ? "PF" : "PJ"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-xs">
                      {cliente.cpf || cliente.cnpj || "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {cliente.cidade && cliente.estado
                        ? `${cliente.cidade}/${cliente.estado}`
                        : cliente.cidade || "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {cliente.fone_res || cliente.fone_com || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          title="Visualizar"
                          onClick={() => abrirVisualizacao(cliente)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          title="Editar"
                          onClick={() => abrirEdicao(cliente)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Excluir"
                          onClick={() => setConfirmarExclusao(cliente)}
                          disabled={excluirClienteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {!isLoading && !isError && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Próxima
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !isError && clientes.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          )}
        </div>

        {/* ── Dialog Cadastro/Edição/Visualização ── */}
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {modo === "create" && "Novo Cliente"}
                {modo === "edit" && "Editar Cliente"}
                {modo === "view" && "Detalhes do Cliente"}
              </DialogTitle>
              <DialogDescription>
                {isView
                  ? "Visualização dos dados do cliente."
                  : "Preencha os dados do cliente. Campos não obrigatórios podem ficar em branco."}
              </DialogDescription>
            </DialogHeader>

            {loadingFull ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Carregando dados do cliente...
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                  {/* Seletor de tipo sempre visível no topo */}
                  <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de cliente</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isView || modo === "edit"}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="f">Pessoa Física</SelectItem>
                              <SelectItem value="j">Pessoa Jurídica</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Abas */}
                  <Tabs value={dialogTab} onValueChange={setDialogTab}>
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="dados" className="gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {tipoWatch === "j" ? "Dados da Empresa" : "Dados Pessoais"}
                      </TabsTrigger>
                      <TabsTrigger value="endereco" className="gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        Endereço
                      </TabsTrigger>
                      <TabsTrigger value="contato" className="gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        Contato
                      </TabsTrigger>
                    </TabsList>

                    {/* ── ABA 1: Dados Gerais ── */}
                    <TabsContent value="dados" className="space-y-4 pt-4">

                      {/* Nome / Razão Social */}
                      <FormField
                        control={form.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {tipoWatch === "j" ? "Nome do responsável *" : "Nome completo *"}
                            </FormLabel>
                            <FormControl>
                              <Input {...field} disabled={isView} placeholder="Digite o nome completo" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {tipoWatch === "j" ? (
                        /* ─── Pessoa Jurídica ─── */
                        <>
                          <FormField
                            control={form.control}
                            name="razao_social"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Razão social</FormLabel>
                                <FormControl>
                                  <Input {...field} disabled={isView} placeholder="Razão social da empresa" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="cnpj"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>CNPJ</FormLabel>
                                  <FormControl>
                                    <Input {...field} disabled={isView} placeholder="00.000.000/0000-00" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="cpf"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>CPF do responsável</FormLabel>
                                  <FormControl>
                                    <Input {...field} disabled={isView} placeholder="000.000.000-00" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="rg"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>RG do responsável</FormLabel>
                                  <FormControl>
                                    <Input {...field} disabled={isView} placeholder="0000000" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="profissao"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Ramo de atividade</FormLabel>
                                  <FormControl>
                                    <Input {...field} disabled={isView} placeholder="Ex: Comércio, Serviços..." />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </>
                      ) : (
                        /* ─── Pessoa Física ─── */
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="cpf"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>CPF</FormLabel>
                                  <FormControl>
                                    <Input {...field} disabled={isView} placeholder="000.000.000-00" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="rg"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>RG</FormLabel>
                                  <FormControl>
                                    <Input {...field} disabled={isView} placeholder="0000000" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="estado_civil"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Estado civil</FormLabel>
                                  <FormControl>
                                    <Select
                                      value={field.value || "_none"}
                                      onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                                      disabled={isView}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="_none">— Não informado —</SelectItem>
                                        {ESTADO_CIVIL_LIST.map((ec) => (
                                          <SelectItem key={ec} value={ec}>{ec}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="conjuge"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Cônjuge / Companheiro(a)</FormLabel>
                                  <FormControl>
                                    <Input {...field} disabled={isView} placeholder="Nome do cônjuge" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="profissao"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Profissão</FormLabel>
                                <FormControl>
                                  <Input {...field} disabled={isView} placeholder="Ex: Engenheiro, Professor..." />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                    </TabsContent>

                    {/* ── ABA 2: Endereço ── */}
                    <TabsContent value="endereco" className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="endereco"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={isView} placeholder="Rua, Av., número..." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="complemento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={isView} placeholder="Apto, bloco, casa..." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="bairro"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bairro</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={isView} placeholder="Bairro" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="cep"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CEP</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={isView} placeholder="00000-000" maxLength={9} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="cidade"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Cidade</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={isView} placeholder="Cidade" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="estado"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>UF</FormLabel>
                              <FormControl>
                                <Select
                                  value={field.value || "_none"}
                                  onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                                  disabled={isView}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="UF" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="_none">—</SelectItem>
                                    {UF_LIST.map((uf) => (
                                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>

                    {/* ── ABA 3: Contato ── */}
                    <TabsContent value="contato" className="space-y-4 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="fone_res"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telefone residencial</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={isView}
                                  placeholder="(00) 0000-0000"
                                  type="tel"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="fone_com"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {tipoWatch === "j" ? "Telefone comercial / Celular" : "Telefone comercial"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={isView}
                                  placeholder="(00) 0 0000-0000"
                                  type="tel"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Dica de navegação para salvar */}
                      {!isView && (
                        <p className="text-xs text-muted-foreground pt-2">
                          Após preencher todas as abas, clique em <strong>Salvar</strong> abaixo.
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* ── Seções exclusivas do modo visualização ── */}
                  {isView && clienteSelecionado && (
                    <div className="space-y-4 pt-2">
                      <Separator />

                      {/* Opções */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Opções
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 text-primary border-primary/40 hover:bg-primary/5"
                            onClick={() => {
                              setDialogAberto(false);
                              navigate(`/pagamentos?cliente=${clienteSelecionado.id_cliente}`);
                            }}
                          >
                            <CreditCard className="h-4 w-4" />
                            Pagamentos
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 text-emerald-600 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={() => {
                              setDialogAberto(false);
                              navigate(`/vendas?cliente=${clienteSelecionado.id_cliente}`);
                            }}
                          >
                            <ShoppingCart className="h-4 w-4" />
                            Vender Lote
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Impressão de Documentos */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Impressão de Documentos
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {/* Contrato A Prazo — abre o ContratoDialog */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/80"
                            onClick={() => {
                              setDialogAberto(false);
                              setContratoDialogAberto(true);
                            }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Contrato
                          </Button>

                          {/* Contrato À Vista — abre o mesmo dialog mas pré-seleciona à vista */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/80"
                            onClick={() => {
                              setDialogAberto(false);
                              setContratoDialogAberto(true);
                            }}
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            Contrato À Vista
                          </Button>

                          {/* Recibo de Quitação — abre o ContratoDialog na aba de recibo */}
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="gap-1.5 h-8 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-200 border"
                            onClick={() => {
                              setDialogAberto(false);
                              setContratoDialogAberto(true);
                              // Um pequeno atraso para garantir que o dialog abriu antes de disparar o evento
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent('abrir-recibo-quitacao'));
                              }, 100);
                            }}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            Recibo de Quitação
                          </Button>

                          {/* Recibo s/ Timbrado — usa o mesmo modelo do recibo, sem diferença visual por enquanto */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/80"
                            onClick={() => {
                              setDialogAberto(false);
                              setContratoDialogAberto(true);
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent("abrir-recibo-quitacao"));
                              }, 100);
                            }}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            Recibo s/ Timbrado
                          </Button>

                          {/* Minuta */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/80"
                            onClick={() => {
                              setDialogAberto(false);
                              setContratoDialogAberto(true);
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent("abrir-minuta"));
                              }, 100);
                            }}
                          >
                            <FileSignature className="h-3.5 w-3.5" />
                            Minuta
                          </Button>

                          {/* Minuta s/ Timbrado */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/80"
                            onClick={() => {
                              setDialogAberto(false);
                              setContratoDialogAberto(true);
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent("abrir-minuta-sem-timbrado"));
                              }, 100);
                            }}
                          >
                            <FileSignature className="h-3.5 w-3.5" />
                            Minuta s/ Timbrado
                          </Button>

                          {/* Termo de Transferência */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/80"
                            onClick={() => {
                              setDialogAberto(false);
                              setContratoDialogAberto(true);
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent("abrir-termo-transferencia"));
                              }, 100);
                            }}
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            Termo de Transferência
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isView && (
                    <DialogFooter className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogAberto(false)}
                        disabled={isSaving}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isSaving}>
                        {isSaving
                          ? "Salvando..."
                          : modo === "create"
                          ? "Cadastrar cliente"
                          : "Salvar alterações"}
                      </Button>
                    </DialogFooter>
                  )}

                  {isView && (
                    <DialogFooter className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogAberto(false)}
                      >
                        Fechar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          if (clienteSelecionado) abrirEdicao(clienteSelecionado);
                        }}
                      >
                        Editar
                      </Button>
                    </DialogFooter>
                  )}
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>

        {/* ── AlertDialog exclusão ── */}
        <AlertDialog
          open={!!confirmarExclusao}
          onOpenChange={(open) => { if (!open) setConfirmarExclusao(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja realmente excluir o cliente{" "}
                <span className="font-semibold">"{confirmarExclusao?.nome}"</span>?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => {
                  if (confirmarExclusao) {
                    excluirClienteMutation.mutate(confirmarExclusao.id_cliente);
                    setConfirmarExclusao(null);
                  }
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Dialog de Contrato ── */}
        {clienteSelecionado && (
          <ContratoDialog
            open={contratoDialogAberto}
            onClose={() => setContratoDialogAberto(false)}
            idCliente={clienteSelecionado.id_cliente}
            nomeCliente={clienteSelecionado.nome}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Clientes;
