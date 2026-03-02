import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Shield, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";

interface Conta {
  id_conta: number;
  apelido: string;
  titular: string;
  agencia: string;
  conta: string;
  convenio?: string | null;
}

interface Empresa {
  id_empresa: number;
  nome_fantasia: string;
  ativo: boolean;
}

type UsuarioPermissaoKey =
  | "clientes_cadastrar"
  | "clientes_alterar"
  | "clientes_excluir"
  | "loteamentos_cadastrar"
  | "loteamentos_alterar"
  | "loteamentos_excluir"
  | "vendas_cadastrar"
  | "vendas_alterar"
  | "vendas_excluir";

interface Usuario {
  id_usuario: number;
  login: string;
  user_master: boolean;
  id_empresa: number;
  clientes_cadastrar: boolean;
  clientes_alterar: boolean;
  clientes_excluir: boolean;
  loteamentos_cadastrar: boolean;
  loteamentos_alterar: boolean;
  loteamentos_excluir: boolean;
  vendas_cadastrar: boolean;
  vendas_alterar: boolean;
  vendas_excluir: boolean;
}

const usuarioFormSchema = z.object({
  login: z.string().min(1, "Login é obrigatório"),
  senha: z.string().min(4, "Senha deve ter ao menos 4 caracteres"),
  user_master: z.boolean().optional().default(false),
  clientes_cadastrar: z.boolean().optional().default(false),
  clientes_alterar: z.boolean().optional().default(false),
  clientes_excluir: z.boolean().optional().default(false),
  loteamentos_cadastrar: z.boolean().optional().default(false),
  loteamentos_alterar: z.boolean().optional().default(false),
  loteamentos_excluir: z.boolean().optional().default(false),
  vendas_cadastrar: z.boolean().optional().default(false),
  vendas_alterar: z.boolean().optional().default(false),
  vendas_excluir: z.boolean().optional().default(false),
  id_empresa: z.number().int().positive().optional(),
});

type UsuarioFormValues = z.infer<typeof usuarioFormSchema>;

const empresaFormSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  razao_social: z.string().optional(),
  cnpj: z.string().optional(),
});

type EmpresaFormValues = z.infer<typeof empresaFormSchema>;

const permissaoLabels: Record<string, string> = {
  clientes_cadastrar: "Cadastrar",
  clientes_alterar: "Alterar",
  clientes_excluir: "Excluir",
  loteamentos_cadastrar: "Cadastrar",
  loteamentos_alterar: "Alterar",
  loteamentos_excluir: "Excluir",
  vendas_cadastrar: "Cadastrar",
  vendas_alterar: "Alterar",
  vendas_excluir: "Excluir",
};

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

const Configuracoes = () => {
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [modoUsuario, setModoUsuario] = useState<"create" | "edit">("create");
  const [dialogUsuarioAberto, setDialogUsuarioAberto] = useState(false);
  const [dialogEmpresaAberto, setDialogEmpresaAberto] = useState(false);
  const [dialogContaAberto, setDialogContaAberto] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<Conta | null>(null);
  const [modoConta, setModoConta] = useState<"create" | "edit">("create");

  const queryClient = useQueryClient();

  const { data: contas, isLoading: loadingContas } = useQuery<Conta[]>({
    queryKey: ["contas"],
    queryFn: async () => {
      const response = await fetch("/api/contas", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar contas");
      }

      return response.json();
    },
  });

  const { data: usuarios, isLoading: loadingUsuarios } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const response = await fetch("/api/usuarios", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar usuários");
      }

      return response.json();
    },
  });

  const { data: empresas } = useQuery<Empresa[]>({
    queryKey: ["empresas"],
    queryFn: async () => {
      const response = await fetch("/api/empresas", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar empresas");
      }

      return response.json();
    },
  });

  const usuarioForm = useForm<UsuarioFormValues>({
    resolver: zodResolver(usuarioFormSchema),
    defaultValues: {
      login: "",
      senha: "",
      user_master: false,
      clientes_cadastrar: false,
      clientes_alterar: false,
      clientes_excluir: false,
      loteamentos_cadastrar: false,
      loteamentos_alterar: false,
      loteamentos_excluir: false,
      vendas_cadastrar: false,
      vendas_alterar: false,
      vendas_excluir: false,
      id_empresa: empresas && empresas.length > 0 ? empresas[0].id_empresa : undefined,
    },
  });

  const empresaForm = useForm<EmpresaFormValues>({
    resolver: zodResolver(empresaFormSchema),
    defaultValues: {
      nome_fantasia: "",
      razao_social: "",
      cnpj: "",
    },
  });

  const contaFormSchema = z.object({
    apelido: z.string().min(1, "Apelido é obrigatório"),
    titular: z.string().min(1, "Titular é obrigatório"),
    agencia: z.string().min(1, "Agência é obrigatória"),
    conta: z.string().min(1, "Conta é obrigatória"),
    convenio: z.string().optional(),
  });

  type ContaFormValues = z.infer<typeof contaFormSchema>;

  const contaForm = useForm<ContaFormValues>({
    resolver: zodResolver(contaFormSchema),
    defaultValues: {
      apelido: "",
      titular: "",
      agencia: "",
      conta: "",
      convenio: "",
    },
  });

  const criarUsuarioMutation = useMutation({
    mutationFn: async (values: UsuarioFormValues) => {
      const response = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar usuário");
      }

      return response.json() as Promise<Usuario>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setDialogUsuarioAberto(false);
      toast({ title: "Usuário criado com sucesso" });
    },
    onError: async (error: unknown) => {
      toast({ title: "Erro ao criar usuário", variant: "destructive" });
    },
  });

  const atualizarUsuarioMutation = useMutation({
    mutationFn: async (input: { id: number; values: Partial<UsuarioFormValues> }) => {
      const response = await fetch(`/api/usuarios/${input.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(input.values),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar usuário");
      }

      return response.json() as Promise<Usuario>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setDialogUsuarioAberto(false);
      toast({ title: "Usuário atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar usuário", variant: "destructive" });
    },
  });

  const excluirUsuarioMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/usuarios/${id}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir usuário");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast({ title: "Usuário excluído com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir usuário", variant: "destructive" });
    },
  });

  const criarEmpresaMutation = useMutation({
    mutationFn: async (values: EmpresaFormValues) => {
      const response = await fetch("/api/empresas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar empresa");
      }

      return response.json() as Promise<Empresa>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      setDialogEmpresaAberto(false);
      empresaForm.reset({
        nome_fantasia: "",
        razao_social: "",
        cnpj: "",
      });
      toast({ title: "Empresa criada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar empresa", variant: "destructive" });
    },
  });

  const criarContaMutation = useMutation({
    mutationFn: async (values: ContaFormValues) => {
      const response = await fetch("/api/contas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar conta");
      }

      return response.json() as Promise<Conta>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas"] });
      setDialogContaAberto(false);
      contaForm.reset({
        apelido: "",
        titular: "",
        agencia: "",
        conta: "",
        convenio: "",
      });
      toast({ title: "Conta criada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar conta", variant: "destructive" });
    },
  });

  const atualizarContaMutation = useMutation({
    mutationFn: async (input: { id: number; values: ContaFormValues }) => {
      const response = await fetch(`/api/contas/${input.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(input.values),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar conta");
      }

      return response.json() as Promise<Conta>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas"] });
      setDialogContaAberto(false);
      toast({ title: "Conta atualizada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar conta", variant: "destructive" });
    },
  });

  const excluirContaMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/contas/${id}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir conta");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas"] });
      toast({ title: "Conta excluída com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir conta", variant: "destructive" });
    },
  });

  function abrirNovoUsuario() {
    setModoUsuario("create");
    setUsuarioSelecionado(null);
    usuarioForm.reset({
      login: "",
      senha: "",
      user_master: false,
      clientes_cadastrar: false,
      clientes_alterar: false,
      clientes_excluir: false,
      loteamentos_cadastrar: false,
      loteamentos_alterar: false,
      loteamentos_excluir: false,
      vendas_cadastrar: false,
      vendas_alterar: false,
      vendas_excluir: false,
      id_empresa: empresas && empresas.length > 0 ? empresas[0].id_empresa : undefined,
    });
    setDialogUsuarioAberto(true);
  }

  function abrirEdicaoUsuario(usuario: Usuario) {
    setModoUsuario("edit");
    setUsuarioSelecionado(usuario);
    usuarioForm.reset({
      login: usuario.login,
      senha: "",
      user_master: usuario.user_master,
      clientes_cadastrar: usuario.clientes_cadastrar,
      clientes_alterar: usuario.clientes_alterar,
      clientes_excluir: usuario.clientes_excluir,
      loteamentos_cadastrar: usuario.loteamentos_cadastrar,
      loteamentos_alterar: usuario.loteamentos_alterar,
      loteamentos_excluir: usuario.loteamentos_excluir,
      vendas_cadastrar: usuario.vendas_cadastrar,
      vendas_alterar: usuario.vendas_alterar,
      vendas_excluir: usuario.vendas_excluir,
      id_empresa: usuario.id_empresa,
    });
    setDialogUsuarioAberto(true);
  }

  function excluirUsuario(usuario: Usuario) {
    const confirmado = window.confirm(`Deseja realmente excluir o usuário "${usuario.login}"?`);
    if (!confirmado) return;
    excluirUsuarioMutation.mutate(usuario.id_usuario);
  }

  function alterarPermissaoInline(
    usuario: Usuario,
    key: UsuarioPermissaoKey,
    value: boolean,
  ) {
    atualizarUsuarioMutation.mutate({
      id: usuario.id_usuario,
      values: {
        [key]: value,
      },
    });
  }

  function onSubmitUsuario(values: UsuarioFormValues) {
    if (modoUsuario === "edit" && usuarioSelecionado) {
      const { senha, ...rest } = values;
      const updateData: Partial<UsuarioFormValues> =
        senha.trim().length > 0 ? values : rest;

      atualizarUsuarioMutation.mutate({ id: usuarioSelecionado.id_usuario, values: updateData });
    } else {
      criarUsuarioMutation.mutate(values);
    }
  }

  function onSubmitEmpresa(values: EmpresaFormValues) {
    criarEmpresaMutation.mutate(values);
  }

  const toggleEmpresaAtivoMutation = useMutation({
    mutationFn: async (input: { id: number; ativo: boolean }) => {
      const response = await fetch(`/api/empresas/${input.id}/ativo`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ ativo: input.ativo }),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar status da empresa");
      }

      return response.json() as Promise<Empresa>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      toast({ title: "Status da empresa atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status da empresa", variant: "destructive" });
    },
  });

  function abrirNovaConta() {
    setModoConta("create");
    setContaSelecionada(null);
    contaForm.reset({
      apelido: "",
      titular: "",
      agencia: "",
      conta: "",
      convenio: "",
    });
    setDialogContaAberto(true);
  }

  function abrirEdicaoConta(conta: Conta) {
    setModoConta("edit");
    setContaSelecionada(conta);
    contaForm.reset({
      apelido: conta.apelido,
      titular: conta.titular,
      agencia: conta.agencia,
      conta: conta.conta,
      convenio: conta.convenio ?? "",
    });
    setDialogContaAberto(true);
  }

  function excluirConta(conta: Conta) {
    const confirmado = window.confirm(`Deseja realmente excluir a conta "${conta.apelido}"?`);
    if (!confirmado) return;
    excluirContaMutation.mutate(conta.id_conta);
  }

  function onSubmitConta(values: ContaFormValues) {
    if (modoConta === "edit" && contaSelecionada) {
      atualizarContaMutation.mutate({ id: contaSelecionada.id_conta, values });
    } else {
      criarContaMutation.mutate(values);
    }
  }
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Contas bancárias, usuários e permissões</p>
        </div>

        <Tabs defaultValue="contas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="contas" className="gap-2">
              <Building2 className="h-4 w-4" />
              Contas Bancárias
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-2">
              <Shield className="h-4 w-4" />
              Usuários & Permissões
            </TabsTrigger>
            <TabsTrigger value="empresas" className="gap-2">
              <Building2 className="h-4 w-4" />
              Empresas
            </TabsTrigger>
          </TabsList>

          {/* CONTAS BANCÁRIAS */}
          <TabsContent value="contas" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {loadingContas
                  ? "Carregando contas..."
                  : contas && contas.length > 0
                  ? `${contas.length} conta(s) cadastradas`
                  : "Nenhuma conta cadastrada"}
              </p>
              <Button size="sm" className="gap-2" onClick={abrirNovaConta}>
                <Plus className="h-4 w-4" />
                Nova Conta
              </Button>
            </div>

            <div className="glass-card rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Apelido</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Titular</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Agência</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Conta</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Convênio</th>
                      <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {contas?.map((conta) => (
                      <tr key={conta.id_conta} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium">{conta.apelido}</td>
                        <td className="px-5 py-3 text-muted-foreground">{conta.titular}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{conta.agencia}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{conta.conta}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{conta.convenio || "—"}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => abrirEdicaoConta(conta)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => excluirConta(conta)}
                              disabled={excluirContaMutation.isPending}
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
            </div>

            <Dialog open={dialogContaAberto} onOpenChange={setDialogContaAberto}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {modoConta === "create" ? "Nova conta bancária" : "Editar conta bancária"}
                  </DialogTitle>
                  <DialogDescription>
                    Informe os dados da conta bancária utilizada para recebimentos.
                  </DialogDescription>
                </DialogHeader>

                <Form {...contaForm}>
                  <form
                    className="space-y-4"
                    onSubmit={contaForm.handleSubmit(onSubmitConta)}
                  >
                    <FormField
                      control={contaForm.control}
                      name="apelido"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apelido</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contaForm.control}
                      name="titular"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titular</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={contaForm.control}
                        name="agencia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agência</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contaForm.control}
                        name="conta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Conta</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contaForm.control}
                        name="convenio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Convênio (opcional)</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={
                          criarContaMutation.isPending || atualizarContaMutation.isPending
                        }
                      >
                        {modoConta === "create" ? "Criar conta" : "Salvar alterações"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* USUÁRIOS & PERMISSÕES */}
          <TabsContent value="usuarios" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {loadingUsuarios
                  ? "Carregando usuários..."
                  : usuarios
                  ? `${usuarios.length} usuário(s) cadastrados`
                  : "Nenhum usuário encontrado"}
              </p>
              <Button size="sm" className="gap-2" onClick={abrirNovoUsuario}>
                <Plus className="h-4 w-4" />
                Novo Usuário
              </Button>
            </div>

            <div className="space-y-4">
              {usuarios?.map((user) => (
                <div key={user.id_usuario} className="glass-card rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold uppercase">
                        {user.login.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{user.login}</p>
                        {user.user_master && (
                          <Badge className="mt-0.5 text-[10px]">Master</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => abrirEdicaoUsuario(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => excluirUsuario(user)}
                        disabled={excluirUsuarioMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {!user.user_master && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border">
                      {(["clientes", "loteamentos", "vendas"] as const).map((modulo) => (
                        <div key={modulo} className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">{modulo}</p>
                          {(["cadastrar", "alterar", "excluir"] as const).map((acao) => {
                            const key = `${modulo}_${acao}` as UsuarioPermissaoKey;
                            const checked = user[key];
                            return (
                              <div key={acao} className="flex items-center justify-between">
                                <Label className="text-xs capitalize">{acao}</Label>
                                <Switch
                                  checked={checked}
                                  onCheckedChange={(value) =>
                                    alterarPermissaoInline(user, key, value)
                                  }
                                  className="scale-75"
                                />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  {user.user_master && (
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                      Usuário master possui acesso total ao sistema
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Dialog open={dialogUsuarioAberto} onOpenChange={setDialogUsuarioAberto}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {modoUsuario === "create" ? "Novo usuário" : "Editar usuário"}
                  </DialogTitle>
                  <DialogDescription>
                    Defina o login, senha e permissões de acesso do usuário.
                  </DialogDescription>
                </DialogHeader>

                <Form {...usuarioForm}>
                  <form
                    className="space-y-4"
                    onSubmit={usuarioForm.handleSubmit(onSubmitUsuario)}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={usuarioForm.control}
                        name="login"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Login</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={usuarioForm.control}
                        name="senha"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {modoUsuario === "create" ? "Senha" : "Senha (deixe em branco para manter)"}
                            </FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={usuarioForm.control}
                        name="id_empresa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Empresa</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={usuarioForm.control}
                      name="user_master"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Usuário master</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Tem acesso total ao sistema e ignora permissões específicas.
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {!usuarioForm.watch("user_master") && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(["clientes", "loteamentos", "vendas"] as const).map((modulo) => (
                          <div key={modulo} className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">
                              {modulo}
                            </p>
                            {(["cadastrar", "alterar", "excluir"] as const).map((acao) => {
                              const key = `${modulo}_${acao}` as UsuarioPermissaoKey;
                              return (
                                <FormField
                                  key={key}
                                  control={usuarioForm.control}
                                name={key as keyof UsuarioFormValues}
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between">
                                      <FormLabel className="text-xs capitalize">
                                        {acao}
                                      </FormLabel>
                                      <FormControl>
                                        <Switch
                                          checked={!!field.value}
                                          onCheckedChange={field.onChange}
                                          className="scale-75"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}

                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={
                          criarUsuarioMutation.isPending ||
                          atualizarUsuarioMutation.isPending
                        }
                      >
                        {modoUsuario === "create" ? "Criar usuário" : "Salvar alterações"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="empresas" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {empresas && empresas.length > 0
                  ? `${empresas.length} empresa(s) cadastradas`
                  : "Nenhuma empresa cadastrada"}
              </p>
              <Button size="sm" className="gap-2" onClick={() => setDialogEmpresaAberto(true)}>
                <Plus className="h-4 w-4" />
                Nova Empresa
              </Button>
            </div>

            <div className="space-y-3">
              {empresas?.map((empresa) => (
                <div
                  key={empresa.id_empresa}
                  className="glass-card rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-sm">{empresa.nome_fantasia}</p>
                    <p className="text-xs text-muted-foreground">ID: {empresa.id_empresa}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={empresa.ativo ? "default" : "outline"}>
                      {empresa.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        {empresa.ativo ? "Desativar" : "Ativar"}
                      </Label>
                      <Switch
                        checked={empresa.ativo}
                        onCheckedChange={(value) =>
                          toggleEmpresaAtivoMutation.mutate({
                            id: empresa.id_empresa,
                            ativo: value,
                          })
                        }
                        disabled={toggleEmpresaAtivoMutation.isPending}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Dialog open={dialogEmpresaAberto} onOpenChange={setDialogEmpresaAberto}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova empresa</DialogTitle>
                  <DialogDescription>
                    Cadastre uma nova empresa para uso no sistema.
                  </DialogDescription>
                </DialogHeader>

                <Form {...empresaForm}>
                  <form
                    className="space-y-4"
                    onSubmit={empresaForm.handleSubmit(onSubmitEmpresa)}
                  >
                    <FormField
                      control={empresaForm.control}
                      name="nome_fantasia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome fantasia</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={empresaForm.control}
                      name="razao_social"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Razão social</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={empresaForm.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={criarEmpresaMutation.isPending}
                      >
                        Criar empresa
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
