import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Grid3X3, User, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface Loteamento {
  id_loteamento: number;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  prop_nome?: string | null;
}

interface LoteDoLoteamento {
  id_lote: number;
  lote: string;
  quadra: string;
  area?: string | null;
  frente?: string | null;
  fundo?: string | null;
  status: "disponivel" | "vendido";
  cliente: string | null;
  status_venda: string | null;
}

type ListaLoteamentosResponse = Loteamento[];

const loteamentoFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  tipo_pessoa: z.enum(["f", "j"]).optional(),
  prop_nome: z.string().optional(),
  cnpj: z.string().optional(),
  prop_endereco: z.string().optional(),
  prop_bairro: z.string().optional(),
  prop_cidade: z.string().optional(),
  prop_estado: z.string().optional(),
  prop_cep: z.string().optional(),
  prop_fone: z.string().optional(),
});

type LoteamentoFormValues = z.infer<typeof loteamentoFormSchema>;

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const statusVendaLabel: Record<string, string> = {
  aberta: "Em aberto",
  quitada: "Quitada",
  cancelada: "Cancelada",
};

const Loteamentos = () => {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const queryClient = useQueryClient();

  const [loteamentoSelecionado, setLoteamentoSelecionado] = useState<Loteamento | null>(null);
  const [dialogLotesAberto, setDialogLotesAberto] = useState(false);
  const [filtroLotes, setFiltroLotes] = useState<"todos" | "disponivel" | "vendido">("todos");

  const form = useForm<LoteamentoFormValues>({
    resolver: zodResolver(loteamentoFormSchema),
    defaultValues: {
      nome: "", endereco: "", cidade: "", estado: "",
      tipo_pessoa: "j", prop_nome: "", cnpj: "",
      prop_endereco: "", prop_bairro: "", prop_cidade: "",
      prop_estado: "", prop_cep: "", prop_fone: "",
    },
  });

  const { data, isLoading, isError } = useQuery<ListaLoteamentosResponse>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const response = await fetch("/api/loteamentos", { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error("Erro ao carregar loteamentos");
      return response.json();
    },
  });

  if (isError) {
    toast({ title: "Erro ao carregar loteamentos", variant: "destructive" });
  }

  // Busca lotes do loteamento selecionado
  const {
    data: lotesDoLoteamento = [],
    isLoading: isLoadingLotes,
  } = useQuery<LoteDoLoteamento[]>({
    queryKey: ["loteamento-lotes", loteamentoSelecionado?.id_loteamento],
    enabled: !!loteamentoSelecionado && dialogLotesAberto,
    queryFn: async () => {
      const response = await fetch(
        `/api/loteamentos/${loteamentoSelecionado!.id_loteamento}/lotes`,
        { headers: { ...getAuthHeaders() } },
      );
      if (!response.ok) throw new Error("Erro ao carregar lotes");
      return response.json();
    },
  });

  const criarLoteamentoMutation = useMutation({
    mutationFn: async (values: LoteamentoFormValues) => {
      const response = await fetch("/api/loteamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(values),
      });

      let data: unknown;
      try { data = await response.json(); } catch { data = null; }

      if (!response.ok) {
        const errorMessage =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao criar loteamento";
        throw new Error(errorMessage);
      }

      return data as Loteamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loteamentos"] });
      setDialogAberto(false);
      toast({ title: "Loteamento criado com sucesso" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar loteamento",
        description: error instanceof Error ? error.message : "Erro ao criar loteamento",
        variant: "destructive",
      });
    },
  });

  const loteamentos = data ?? [];

  function abrirNovoLoteamento() {
    form.reset({
      nome: "", endereco: "", cidade: "", estado: "",
      tipo_pessoa: "j", prop_nome: "", cnpj: "",
      prop_endereco: "", prop_bairro: "", prop_cidade: "",
      prop_estado: "", prop_cep: "", prop_fone: "",
    });
    setDialogAberto(true);
  }

  function abrirLotes(lot: Loteamento) {
    setLoteamentoSelecionado(lot);
    setFiltroLotes("todos");
    setDialogLotesAberto(true);
  }

  function onSubmit(values: LoteamentoFormValues) {
    criarLoteamentoMutation.mutate(values);
  }

  const lotesFiltrados = lotesDoLoteamento.filter((l) =>
    filtroLotes === "todos" ? true : l.status === filtroLotes
  );

  const totalDisponivel = lotesDoLoteamento.filter((l) => l.status === "disponivel").length;
  const totalVendido = lotesDoLoteamento.filter((l) => l.status === "vendido").length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Loteamentos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Carregando loteamentos..." : `${loteamentos.length} loteamentos cadastrados`}
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={abrirNovoLoteamento}>
            <Plus className="h-4 w-4" />
            Novo Loteamento
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loteamentos
            .slice((page - 1) * pageSize, page * pageSize)
            .map((lot, i) => (
              <div
                key={lot.id_loteamento}
                className="glass-card rounded-lg p-5 space-y-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer animate-fade-in group"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => abrirLotes(lot)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">{lot.nome}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {lot.cidade ?? "-"}{lot.estado ? `/${lot.estado}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">Loteamento</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>

                <div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: "100%" }} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Grid3X3 className="h-3 w-3" />
                    <span className="group-hover:text-primary transition-colors">Ver lotes</span>
                  </div>
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                    Prop: {lot.prop_nome ?? "-"}
                  </span>
                </div>
              </div>
            ))}
        </div>

        {loteamentos.length > pageSize && (
          <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
            <span>Página {page} de {Math.max(1, Math.ceil(loteamentos.length / pageSize))}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={page >= Math.ceil(loteamentos.length / pageSize)}
                onClick={() => setPage((p) => Math.min(Math.ceil(loteamentos.length / pageSize), p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog - Lotes do Loteamento */}
      <Dialog open={dialogLotesAberto} onOpenChange={(open) => { if (!open) { setDialogLotesAberto(false); setLoteamentoSelecionado(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              {loteamentoSelecionado?.nome}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {loteamentoSelecionado?.cidade ?? "-"}
              {loteamentoSelecionado?.estado ? `/${loteamentoSelecionado.estado}` : ""}
              {loteamentoSelecionado?.prop_nome && (
                <span className="ml-2">· Prop: {loteamentoSelecionado.prop_nome}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Resumo + filtros */}
          <div className="flex flex-wrap items-center gap-3 py-2 border-b border-border">
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span><span className="font-semibold text-foreground">{lotesDoLoteamento.length}</span> lotes</span>
              <span className="text-green-600 dark:text-green-400"><span className="font-semibold">{totalDisponivel}</span> disponíveis</span>
              <span className="text-orange-500"><span className="font-semibold">{totalVendido}</span> vendidos</span>
            </div>
            <div className="ml-auto flex gap-1.5">
              {(["todos", "disponivel", "vendido"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filtroLotes === f ? "default" : "outline"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setFiltroLotes(f)}
                >
                  {f === "todos" ? "Todos" : f === "disponivel" ? "Disponíveis" : "Vendidos"}
                </Button>
              ))}
            </div>
          </div>

          {/* Tabela de lotes */}
          <div className="overflow-y-auto flex-1">
            {isLoadingLotes ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando lotes...</div>
            ) : lotesFiltrados.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Nenhum lote encontrado</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Quadra</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Lote</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Área</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Frente</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Cliente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lotesFiltrados.map((lote) => (
                    <tr key={lote.id_lote} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{lote.quadra}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{lote.lote}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{lote.area || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{lote.frente || "—"}</td>
                      <td className="px-4 py-2.5">
                        {lote.status === "disponivel" ? (
                          <Badge variant="default" className="text-xs">Disponível</Badge>
                        ) : (
                          <div className="space-y-0.5">
                            <Badge variant="secondary" className="text-xs">Vendido</Badge>
                            {lote.status_venda && (
                              <p className="text-[10px] text-muted-foreground">
                                {statusVendaLabel[lote.status_venda] ?? lote.status_venda}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {lote.cliente ? (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-medium">{lote.cliente}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" onClick={() => setDialogLotesAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog - Novo Loteamento */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Loteamento</DialogTitle>
            <DialogDescription>Preencha os dados do loteamento.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cidade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="estado" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <FormControl><Input maxLength={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="prop_nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proprietário</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={criarLoteamentoMutation.isPending}>
                  Cadastrar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Loteamentos;
