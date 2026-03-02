import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Grid3X3 } from "lucide-react";
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
  return {
    Authorization: `Bearer ${token}`,
  };
}

const Loteamentos = () => {
  const [dialogAberto, setDialogAberto] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<LoteamentoFormValues>({
    resolver: zodResolver(loteamentoFormSchema),
    defaultValues: {
      nome: "",
      endereco: "",
      cidade: "",
      estado: "",
      tipo_pessoa: "j",
      prop_nome: "",
      cnpj: "",
      prop_endereco: "",
      prop_bairro: "",
      prop_cidade: "",
      prop_estado: "",
      prop_cep: "",
      prop_fone: "",
    },
  });

  const { data, isLoading, isError } = useQuery<ListaLoteamentosResponse>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const response = await fetch("/api/loteamentos", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar loteamentos");
      }

      return response.json();
    },
  });

  if (isError) {
    toast({ title: "Erro ao carregar loteamentos", variant: "destructive" });
  }

  const criarLoteamentoMutation = useMutation({
    mutationFn: async (values: LoteamentoFormValues) => {
      const response = await fetch("/api/loteamentos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(values),
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
      const description = error instanceof Error ? error.message : "Erro ao criar loteamento";

      toast({
        title: "Erro ao criar loteamento",
        description,
        variant: "destructive",
      });
    },
  });

  const loteamentos = data ?? [];

  function abrirNovoLoteamento() {
    form.reset({
      nome: "",
      endereco: "",
      cidade: "",
      estado: "",
      tipo_pessoa: "j",
      prop_nome: "",
      cnpj: "",
      prop_endereco: "",
      prop_bairro: "",
      prop_cidade: "",
      prop_estado: "",
      prop_cep: "",
      prop_fone: "",
    });
    setDialogAberto(true);
  }

  function onSubmit(values: LoteamentoFormValues) {
    criarLoteamentoMutation.mutate(values);
  }

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
          {loteamentos.map((lot, i) => {
            return (
              <div
                key={lot.id_loteamento}
                className="glass-card rounded-lg p-5 space-y-4 hover:border-primary/30 transition-colors cursor-pointer animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{lot.nome}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      {lot.cidade ?? "-"}{lot.estado ? `/${lot.estado}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Loteamento
                  </Badge>
                </div>

                <div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `100%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Grid3X3 className="h-3 w-3" />
                    Lotes vinculados
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Prop: {lot.prop_nome ?? "-"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Loteamento</DialogTitle>
            <DialogDescription>Preencha os dados do loteamento.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <Input maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prop_nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proprietário</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
