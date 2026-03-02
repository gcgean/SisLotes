import { useState } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react";
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
  return {
    Authorization: `Bearer ${token}`,
  };
}

const Lotes = () => {
  const [search, setSearch] = useState("");
  const [filterLoteamento, setFilterLoteamento] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "disponivel" | "vendido">("all");
  const [dialogAberto, setDialogAberto] = useState(false);
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
    isLoading: isLoadingLoteamentos,
    isError: isErrorLoteamentos,
    error: errorLoteamentos,
  } = useQuery<Loteamento[], Error>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const response = await fetch("/api/loteamentos", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errorMessage =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao carregar loteamentos";

        throw new Error(errorMessage);
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
        headers: {
          ...getAuthHeaders(),
        },
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errorMessage =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao carregar lotes";

        throw new Error(errorMessage);
      }

      return data as Lote[];
    },
  });

  if (isErrorLoteamentos) {
    toast({
      title: "Erro ao carregar loteamentos",
      description: errorLoteamentos?.message,
      variant: "destructive",
    });
  }

  if (isErrorLotes) {
    toast({
      title: "Erro ao carregar lotes",
      description: errorLotes?.message,
      variant: "destructive",
    });
  }

  const loteamentos = loteamentosData ?? [];
  const lotes = lotesData ?? [];

  const loteamentosMap = new Map(loteamentos.map((l) => [l.id_loteamento, l]));

  const criarLoteMutation = useMutation({
    mutationFn: async (values: LoteFormValues) => {
      const response = await fetch("/api/lotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ...values,
          id_loteamento: Number(values.id_loteamento),
        }),
      });

      let data: unknown;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errorMessage =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao criar lote";

        throw new Error(errorMessage);
      }

      return data as Lote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      setDialogAberto(false);
      toast({ title: "Lote criado com sucesso" });
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : "Erro ao criar lote";

      toast({
        title: "Erro ao criar lote",
        description,
        variant: "destructive",
      });
    },
  });

  const isLoading = isLoadingLotes || isLoadingLoteamentos;

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
    setDialogAberto(true);
  }

  function onSubmit(values: LoteFormValues) {
    criarLoteMutation.mutate(values);
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lotes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Carregando lotes..." : `${lotes.length} lotes · ${totalDisponivel} disponíveis · ${totalVendido} vendidos`}
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={abrirNovoLote}>
            <Plus className="h-4 w-4" />
            Novo Lote
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por lote ou quadra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterLoteamento} onValueChange={setFilterLoteamento}>
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
          <div className="flex gap-2">
            {(["all", "disponivel", "vendido"] as const).map((s) => (
              <Button
                key={s}
                variant={filterStatus === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(s)}
              >
                {s === "all" ? "Todos" : s === "disponivel" ? "Disponível" : "Vendido"}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
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
                {filtered.map((lote) => {
                  const nomeLoteamento = loteamentosMap.get(lote.id_loteamento)?.nome ?? "-";

                  return (
                    <tr key={lote.id_lote} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium">{nomeLoteamento}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.quadra}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.lote}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.area}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.frente}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.fundo}</td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={lote.status === "disponivel" ? "default" : "secondary"}
                        className={lote.status === "disponivel" ? "" : ""}
                      >
                        {lote.status === "disponivel" ? "Disponível" : "Vendido"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum lote encontrado
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lote</DialogTitle>
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
                        disabled={loteamentos.length === 0}
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
                        <Input {...field} />
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
                        <Input {...field} />
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
                        <Input {...field} />
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
                        <Input {...field} />
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
                        <Input {...field} />
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
                        <Input {...field} />
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={criarLoteMutation.isPending}>
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

export default Lotes;
