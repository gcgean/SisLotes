import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Plus, Eye, Edit, Trash2, User, Phone, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type LoteStatus = "disponivel" | "vendido";

interface Loteamento {
  id_loteamento: number;
  nome: string;
}

interface Lote {
  id_lote: number;
  id_loteamento: number;
  lote: string;
  quadra: string;
  area?: string | null;
  frente?: string | null;
  fundo?: string | null;
  esquerdo?: string | null;
  direito?: string | null;
  status: LoteStatus;
}

interface LoteClienteResponse {
  lote: {
    id_lote: number;
    lote: string;
    quadra: string;
    area: string | null;
    frente: string | null;
    fundo: string | null;
    esquerdo: string | null;
    direito: string | null;
    loteamento: string | null;
    cidade: string | null;
    estado: string | null;
  };
  status: "disponivel" | "vendido";
  venda: {
    id_venda: number;
    data_venda: string;
    valor_entrada: number;
    parcelas: number;
    porcentagem: number;
    status: string;
  } | null;
  cliente: {
    id_cliente: number;
    nome: string;
    cpf: string | null;
    cnpj: string | null;
    tipo: "f" | "j";
    fone_res: string | null;
    fone_com: string | null;
    cidade: string | null;
    estado: string | null;
  } | null;
}

const statusVendaLabel: Record<string, string> = {
  aberta: "Em aberto",
  quitada: "Quitada",
  cancelada: "Cancelada",
};

const loteFormSchema = z.object({
  id_loteamento: z.string().min(1, "Loteamento é obrigatório"),
  lote: z.string().min(1, "Lote é obrigatório"),
  quadra: z.string().min(1, "Quadra é obrigatória"),
  area: z.string().optional(),
  frente: z.string().optional(),
  fundo: z.string().optional(),
  esquerdo: z.string().optional(),
  direito: z.string().optional(),
});

type LoteFormValues = z.infer<typeof loteFormSchema>;

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const Lotes = () => {
  const [search, setSearch] = useState("");
  const [filterLoteamento, setFilterLoteamento] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "disponivel" | "vendido">("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [dialogAberto, setDialogAberto] = useState(false);
  const [modoDialog, setModoDialog] = useState<"create" | "edit" | "view">("create");
  const [loteSelecionado, setLoteSelecionado] = useState<Lote | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Lote | null>(null);
  const [loteCliente, setLoteCliente] = useState<Lote | null>(null);
  const [dialogClienteAberto, setDialogClienteAberto] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<LoteFormValues>({
    resolver: zodResolver(loteFormSchema),
    defaultValues: {
      id_loteamento: "",
      lote: "",
      quadra: "",
      area: "",
      frente: "",
      fundo: "",
      esquerdo: "",
      direito: "",
    },
  });

  const {
    data: loteamentosData,
    isError: isErrorLoteamentos,
    error: errorLoteamentos,
  } = useQuery<Loteamento[], Error>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const response = await fetch("/api/loteamentos", {
        headers: { ...getAuthHeaders() },
      });

      let data: unknown;
      try { data = await response.json(); } catch { data = null; }

      if (!response.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao carregar loteamentos";
        throw new Error(msg);
      }

      return data as Loteamento[];
    },
  });

  const {
    data: lotesData,
    isLoading: isLoadingLotes,
    isError: isErrorLotes,
    error: errorLotes,
  } = useQuery<Lote[], Error>({
    queryKey: ["lotes"],
    queryFn: async () => {
      const response = await fetch("/api/lotes", {
        headers: { ...getAuthHeaders() },
      });

      let data: unknown;
      try { data = await response.json(); } catch { data = null; }

      if (!response.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao carregar lotes";
        throw new Error(msg);
      }

      return data as Lote[];
    },
  });

  // Query para buscar cliente do lote selecionado
  const { data: loteClienteData, isLoading: isLoadingCliente } = useQuery<LoteClienteResponse>({
    queryKey: ["lote-cliente", loteCliente?.id_lote],
    enabled: !!loteCliente && dialogClienteAberto,
    queryFn: async () => {
      const response = await fetch(`/api/lotes/${loteCliente!.id_lote}/cliente`, {
        headers: { ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error("Erro ao carregar dados do lote");
      return response.json();
    },
  });

  // Toasts de erro via useEffect para não chamar durante o render
  useEffect(() => {
    if (isErrorLoteamentos && errorLoteamentos) {
      toast({
        title: "Erro ao carregar loteamentos",
        description: errorLoteamentos.message,
        variant: "destructive",
      });
    }
  }, [isErrorLoteamentos, errorLoteamentos]);

  useEffect(() => {
    if (isErrorLotes && errorLotes) {
      toast({
        title: "Erro ao carregar lotes",
        description: errorLotes.message,
        variant: "destructive",
      });
    }
  }, [isErrorLotes, errorLotes]);

  const loteamentos = loteamentosData ?? [];
  const lotes = lotesData ?? [];
  const loteamentosMap = new Map(loteamentos.map((l) => [l.id_loteamento, l]));

  const criarLoteMutation = useMutation({
    mutationFn: async (values: LoteFormValues) => {
      const response = await fetch("/api/lotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ...values, id_loteamento: Number(values.id_loteamento) }),
      });

      let data: unknown;
      try { data = await response.json(); } catch { data = null; }

      if (!response.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao criar lote";
        throw new Error(msg);
      }

      return data as Lote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      setDialogAberto(false);
      form.reset();
      toast({ title: "Lote criado com sucesso" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar lote",
        description: error instanceof Error ? error.message : "Erro ao criar lote",
        variant: "destructive",
      });
    },
  });

  const editarLoteMutation = useMutation({
    mutationFn: async (values: LoteFormValues) => {
      if (!loteSelecionado) throw new Error("Nenhum lote selecionado");

      const response = await fetch(`/api/lotes/${loteSelecionado.id_lote}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ...values, id_loteamento: Number(values.id_loteamento) }),
      });

      let data: unknown;
      try { data = await response.json(); } catch { data = null; }

      if (!response.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao editar lote";
        throw new Error(msg);
      }

      return data as Lote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      setDialogAberto(false);
      setLoteSelecionado(null);
      toast({ title: "Lote atualizado com sucesso" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao editar lote",
        description: error instanceof Error ? error.message : "Erro ao editar lote",
        variant: "destructive",
      });
    },
  });

  const excluirLoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/lotes/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });

      if (!response.ok) {
        let data: unknown;
        try { data = await response.json(); } catch { data = null; }
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao excluir lote";
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      setConfirmarExclusao(null);
      toast({ title: "Lote excluído com sucesso" });
    },
    onError: (error) => {
      setConfirmarExclusao(null);
      toast({
        title: "Erro ao excluir lote",
        description: error instanceof Error ? error.message : "Erro ao excluir lote",
        variant: "destructive",
      });
    },
  });

  const filtered = lotes.filter((l) => {
    const nomeLoteamento = loteamentosMap.get(l.id_loteamento)?.nome ?? "";
    const matchSearch =
      l.lote.includes(search) ||
      l.quadra.toLowerCase().includes(search.toLowerCase()) ||
      nomeLoteamento.toLowerCase().includes(search.toLowerCase());
    const matchLot = filterLoteamento === "all" || l.id_loteamento === Number(filterLoteamento);
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    return matchSearch && matchLot && matchStatus;
  });

  const totalDisponivel = lotes.filter((l) => l.status === "disponivel").length;
  const totalVendido = lotes.filter((l) => l.status === "vendido").length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function abrirNovoLote() {
    form.reset({
      id_loteamento: filterLoteamento !== "all" ? filterLoteamento : "",
      lote: "",
      quadra: "",
      area: "",
      frente: "",
      fundo: "",
      esquerdo: "",
      direito: "",
    });
    setModoDialog("create");
    setLoteSelecionado(null);
    setDialogAberto(true);
  }

  function abrirClienteLote(lote: Lote) {
    setLoteCliente(lote);
    setDialogClienteAberto(true);
  }

  function abrirVisualizarLote(lote: Lote) {
    form.reset({
      id_loteamento: String(lote.id_loteamento),
      lote: lote.lote,
      quadra: lote.quadra,
      area: lote.area ?? "",
      frente: lote.frente ?? "",
      fundo: lote.fundo ?? "",
      esquerdo: lote.esquerdo ?? "",
      direito: lote.direito ?? "",
    });
    setModoDialog("view");
    setLoteSelecionado(lote);
    setDialogAberto(true);
  }

  function abrirEditarLote(lote: Lote) {
    form.reset({
      id_loteamento: String(lote.id_loteamento),
      lote: lote.lote,
      quadra: lote.quadra,
      area: lote.area ?? "",
      frente: lote.frente ?? "",
      fundo: lote.fundo ?? "",
      esquerdo: lote.esquerdo ?? "",
      direito: lote.direito ?? "",
    });
    setModoDialog("edit");
    setLoteSelecionado(lote);
    setDialogAberto(true);
  }

  function onSubmit(values: LoteFormValues) {
    if (modoDialog === "edit") {
      editarLoteMutation.mutate(values);
    } else {
      criarLoteMutation.mutate(values);
    }
  }

  const isSubmitting = criarLoteMutation.isPending || editarLoteMutation.isPending;
  const isReadOnly = modoDialog === "view";

  const dialogTitle =
    modoDialog === "create" ? "Novo Lote" :
    modoDialog === "edit" ? "Editar Lote" :
    "Detalhes do Lote";

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lotes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoadingLotes
                ? "Carregando lotes..."
                : `${lotes.length} lotes · ${totalDisponivel} disponíveis · ${totalVendido} vendidos`}
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={abrirNovoLote}>
            <Plus className="h-4 w-4" />
            Novo Lote
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row md:flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por lote ou quadra..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={filterLoteamento} onValueChange={(v) => { setFilterLoteamento(v); setPage(1); }}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Loteamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os loteamentos</SelectItem>
              {loteamentos.map((l) => (
                <SelectItem key={l.id_loteamento} value={String(l.id_loteamento)}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            {(["all", "disponivel", "vendido"] as const).map((s) => (
              <Button
                key={s}
                variant={filterStatus === s ? "default" : "outline"}
                size="sm"
                onClick={() => { setFilterStatus(s); setPage(1); }}
              >
                {s === "all" ? "Todos" : s === "disponivel" ? "Disponível" : "Vendido"}
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
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Loteamento</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Quadra</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Área</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Frente</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Fundo</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((lote) => {
                  const nomeLoteamento = loteamentosMap.get(lote.id_loteamento)?.nome ?? "-";
                  return (
                    <tr
                      key={lote.id_lote}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => abrirClienteLote(lote)}
                    >
                      <td className="px-5 py-3 font-medium">{nomeLoteamento}</td>
                      <td className="px-5 py-3 text-muted-foreground">{lote.quadra}</td>
                      <td className="px-5 py-3 text-muted-foreground">{lote.lote}</td>
                      <td className="px-5 py-3 text-muted-foreground">{lote.area || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{lote.frente || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{lote.fundo || "—"}</td>
                      <td className="px-5 py-3">
                        <Badge variant={lote.status === "disponivel" ? "default" : "secondary"}>
                          {lote.status === "disponivel" ? "Disponível" : "Vendido"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Ver cliente"
                            onClick={() => abrirClienteLote(lote)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar"
                            disabled={lote.status === "vendido"}
                            onClick={() => abrirEditarLote(lote)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Excluir"
                            disabled={lote.status === "vendido"}
                            onClick={() => setConfirmarExclusao(lote)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && !isLoadingLotes && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum lote encontrado
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                Mostrando {paginated.length} de {filtered.length} lotes · Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog criar/editar/visualizar lote */}
      <Dialog open={dialogAberto} onOpenChange={(open) => { if (!open) { setDialogAberto(false); setLoteSelecionado(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="id_loteamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loteamento</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isReadOnly || loteamentos.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um loteamento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loteamentos.map((l) => (
                            <SelectItem key={l.id_loteamento} value={String(l.id_loteamento)}>
                              {l.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quadra"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quadra</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lote</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frente</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fundo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fundo</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="esquerdo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Esquerdo</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="direito"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Direito</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {!isReadOnly && (
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {modoDialog === "edit" ? "Salvar Alterações" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              )}

              {isReadOnly && (
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setModoDialog("edit");
                    }}
                    disabled={loteSelecionado?.status === "vendido"}
                  >
                    Editar
                  </Button>
                </DialogFooter>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmação de exclusão */}
      <AlertDialog open={!!confirmarExclusao} onOpenChange={(open) => { if (!open) setConfirmarExclusao(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir o lote{" "}
              <span className="font-semibold">
                {confirmarExclusao ? `${confirmarExclusao.quadra} - ${confirmarExclusao.lote}` : ""}
              </span>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (confirmarExclusao) {
                  excluirLoteMutation.mutate(confirmarExclusao.id_lote);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog - Cliente do Lote */}
      <Dialog open={dialogClienteAberto} onOpenChange={(open) => { if (!open) { setDialogClienteAberto(false); setLoteCliente(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Lote {loteCliente ? `${loteCliente.quadra} · ${loteCliente.lote}` : ""}
            </DialogTitle>
          </DialogHeader>

          {isLoadingCliente ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : loteClienteData ? (
            <div className="space-y-4">
              {/* Info do lote */}
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/40 rounded-lg p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Loteamento</p>
                  <p className="font-medium">{loteClienteData.lote.loteamento ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cidade/UF</p>
                  <p className="font-medium">
                    {loteClienteData.lote.cidade ?? "—"}
                    {loteClienteData.lote.estado ? `/${loteClienteData.lote.estado}` : ""}
                  </p>
                </div>
                {loteClienteData.lote.area && (
                  <div>
                    <p className="text-xs text-muted-foreground">Área</p>
                    <p className="font-medium">{loteClienteData.lote.area}</p>
                  </div>
                )}
                {loteClienteData.lote.frente && (
                  <div>
                    <p className="text-xs text-muted-foreground">Frente</p>
                    <p className="font-medium">{loteClienteData.lote.frente}</p>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant={loteClienteData.status === "disponivel" ? "default" : "secondary"}>
                  {loteClienteData.status === "disponivel" ? "Disponível" : "Vendido"}
                </Badge>
                {loteClienteData.venda && (
                  <Badge variant="outline" className="text-xs">
                    {statusVendaLabel[loteClienteData.venda.status] ?? loteClienteData.venda.status}
                  </Badge>
                )}
              </div>

              {/* Cliente */}
              {loteClienteData.cliente ? (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</p>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <p className="font-semibold">{loteClienteData.cliente.nome}</p>
                      {(loteClienteData.cliente.cpf || loteClienteData.cliente.cnpj) && (
                        <p className="text-xs text-muted-foreground">
                          {loteClienteData.cliente.tipo === "f" ? "CPF" : "CNPJ"}:{" "}
                          {loteClienteData.cliente.cpf ?? loteClienteData.cliente.cnpj}
                        </p>
                      )}
                      {(loteClienteData.cliente.fone_res || loteClienteData.cliente.fone_com) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {loteClienteData.cliente.fone_res ?? loteClienteData.cliente.fone_com}
                        </div>
                      )}
                      {loteClienteData.cliente.cidade && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {loteClienteData.cliente.cidade}
                          {loteClienteData.cliente.estado ? `/${loteClienteData.cliente.estado}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  {loteClienteData.venda && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-xs">
                      <div>
                        <p className="text-muted-foreground">Data venda</p>
                        <p className="font-medium">
                          {new Date(loteClienteData.venda.data_venda).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Parcelas</p>
                        <p className="font-medium">{loteClienteData.venda.parcelas}x</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Juros</p>
                        <p className="font-medium">{loteClienteData.venda.porcentagem}%</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-lg p-6 text-center">
                  <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Lote disponível — sem cliente vinculado</p>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogClienteAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Lotes;
