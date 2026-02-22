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

const mockContas = [
  { id: 1, apelido: "BB Principal", titular: "Empresa ABC", agencia: "1234-5", conta: "12345-6", convenio: "123456" },
  { id: 2, apelido: "Caixa", titular: "Empresa ABC", agencia: "5678-9", conta: "67890-1", convenio: "654321" },
  { id: 3, apelido: "Itaú Emp.", titular: "Empresa ABC", agencia: "9012-3", conta: "34567-8", convenio: "" },
];

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
});

type UsuarioFormValues = z.infer<typeof usuarioFormSchema>;

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

  const queryClient = useQueryClient();

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
          </TabsList>

          {/* CONTAS BANCÁRIAS */}
          <TabsContent value="contas" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-2">
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
                    {mockContas.map((conta) => (
                      <tr key={conta.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium">{conta.apelido}</td>
                        <td className="px-5 py-3 text-muted-foreground">{conta.titular}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{conta.agencia}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{conta.conta}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{conta.convenio || "—"}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
