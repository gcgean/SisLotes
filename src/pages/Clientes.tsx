import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Cliente {
  id_cliente: number;
  tipo: "f" | "j";
  nome: string;
  razao_social?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  cidade?: string | null;
  estado?: string | null;
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

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

const Clientes = () => {
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"all" | "f" | "j">("all");
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [modo, setModo] = useState<"create" | "edit" | "view">("create");
  const [dialogAberto, setDialogAberto] = useState(false);

  const queryClient = useQueryClient();

  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteFormSchema),
    defaultValues: {
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
    },
  });

  const { data, isLoading, isError } = useQuery<ListaClientesResponse>({
    queryKey: ["clientes", { search, filterTipo }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "50");
      if (search) params.set("search", search);
      if (filterTipo !== "all") params.set("tipo", filterTipo);

      const response = await fetch(`/api/clientes?${params.toString()}`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar clientes");
      }

      return response.json();
    },
  });

  const clientes = data?.data ?? [];

  const criarClienteMutation = useMutation({
    mutationFn: async (values: ClienteFormValues) => {
      const response = await fetch("/api/clientes", {
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
            : "Erro ao cadastrar cliente";

        throw new Error(errorMessage);
      }

      return data as Cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setDialogAberto(false);
      toast({ title: "Cliente cadastrado com sucesso" });
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : "Erro ao cadastrar cliente";

      toast({
        title: "Erro ao cadastrar cliente",
        description,
        variant: "destructive",
      });
    },
  });

  const atualizarClienteMutation = useMutation({
    mutationFn: async (input: { id: number; values: ClienteFormValues }) => {
      const response = await fetch(`/api/clientes/${input.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(input.values),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar cliente");
      }

      return response.json() as Promise<Cliente>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setDialogAberto(false);
      toast({ title: "Cliente atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar cliente", variant: "destructive" });
    },
  });

  const excluirClienteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/clientes/${id}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir cliente");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Cliente excluído com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir cliente", variant: "destructive" });
    },
  });

  function abrirNovoCliente() {
    setModo("create");
    setClienteSelecionado(null);
    form.reset({
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
    });
    setDialogAberto(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setModo("edit");
    setClienteSelecionado(cliente);
    form.reset({
      tipo: cliente.tipo,
      nome: cliente.nome,
      razao_social: cliente.razao_social ?? "",
      cpf: cliente.cpf ?? "",
      cnpj: cliente.cnpj ?? "",
      rg: "",
      estado_civil: "",
      conjuge: "",
      profissao: "",
      endereco: "",
      bairro: "",
      cidade: cliente.cidade ?? "",
      estado: cliente.estado ?? "",
      cep: "",
      complemento: "",
      fone_res: cliente.fone_res ?? "",
      fone_com: cliente.fone_com ?? "",
    });
    setDialogAberto(true);
  }

  function abrirVisualizacao(cliente: Cliente) {
    setModo("view");
    setClienteSelecionado(cliente);
    form.reset({
      tipo: cliente.tipo,
      nome: cliente.nome,
      razao_social: cliente.razao_social ?? "",
      cpf: cliente.cpf ?? "",
      cnpj: cliente.cnpj ?? "",
      rg: "",
      estado_civil: "",
      conjuge: "",
      profissao: "",
      endereco: "",
      bairro: "",
      cidade: cliente.cidade ?? "",
      estado: cliente.estado ?? "",
      cep: "",
      complemento: "",
      fone_res: cliente.fone_res ?? "",
      fone_com: cliente.fone_com ?? "",
    });
    setDialogAberto(true);
  }

  function excluirCliente(cliente: Cliente) {
    const confirmado = window.confirm(`Deseja realmente excluir o cliente "${cliente.nome}"?`);
    if (!confirmado) return;
    excluirClienteMutation.mutate(cliente.id_cliente);
  }

  function onSubmit(values: ClienteFormValues) {
    if (modo === "edit" && clienteSelecionado) {
      atualizarClienteMutation.mutate({ id: clienteSelecionado.id_cliente, values });
    } else {
      criarClienteMutation.mutate(values);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
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

        {/* Table */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">CPF/CNPJ</th>
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
                {!isLoading &&
                  !isError &&
                  clientes.map((cliente) => (
                    <tr key={cliente.id_cliente} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium">{cliente.nome}</td>
                    <td className="px-5 py-3">
                      <Badge variant={cliente.tipo === "f" ? "secondary" : "outline"}>
                        {cliente.tipo === "f" ? "PF" : "PJ"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-xs">
                      {cliente.cpf || cliente.cnpj}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {cliente.cidade}/{cliente.estado}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {cliente.fone_res || cliente.fone_com}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirVisualizacao(cliente)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEdicao(cliente)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => excluirCliente(cliente)}
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
          {!isLoading && !isError && clientes.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          )}
        </div>

        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {modo === "create" && "Novo Cliente"}
                {modo === "edit" && "Editar Cliente"}
                {modo === "view" && "Detalhes do Cliente"}
              </DialogTitle>
              <DialogDescription>
                {modo === "view"
                  ? "Visualize os dados do cliente."
                  : "Preencha os dados do cliente. Campos não obrigatórios podem ficar em branco."}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={modo === "view"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
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

                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={modo === "view"} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {form.watch("tipo") === "f" ? (
                    <>
                      <FormField
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={modo === "view"} />
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
                              <Input {...field} disabled={modo === "view"} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="estado_civil"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado civil</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={modo === "view"} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="cnpj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CNPJ</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={modo === "view"} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="razao_social"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Razão social</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={modo === "view"} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="profissao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profissão</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={modo === "view"} />
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
                        <FormLabel>Cônjuge</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={modo === "view"} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={modo === "view"} />
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
                          <Input {...field} disabled={modo === "view"} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="bairro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={modo === "view"} />
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
                          <Input {...field} disabled={modo === "view"} />
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
                          <Input {...field} disabled={modo === "view"} />
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
                          <Input {...field} disabled={modo === "view"} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fone_res"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone residencial</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={modo === "view"} />
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
                        <FormLabel>Telefone comercial</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={modo === "view"} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {modo !== "view" && (
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={criarClienteMutation.isPending || atualizarClienteMutation.isPending}
                    >
                      {modo === "create" ? "Cadastrar" : "Salvar alterações"}
                    </Button>
                  </DialogFooter>
                )}
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Clientes;
