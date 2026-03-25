import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, KeyRound } from "lucide-react";

const loginSchema = z.object({
  login: z.string().min(1, "Login é obrigatório"),
  senha: z.string().min(1, "Senha é obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginResponse {
  token: string;
  usuario: {
    id_usuario: number;
    login: string;
    user_master: boolean;
  };
}

const Login = () => {
  const navigate = useNavigate();
  const { token, login } = useAuth();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [dialogEsqueciAberto, setDialogEsqueciAberto] = useState(false);
  const [loginRecuperacao, setLoginRecuperacao] = useState("");
  const [senhaTemporaria, setSenhaTemporaria] = useState<string | null>(null);

  const [lembrarUsuario, setLembrarUsuario] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: "", senha: "" },
  });

  useEffect(() => {
    // Carrega o usuário salvo caso exista
    const savedLogin = localStorage.getItem("sislote:savedLogin");
    if (savedLogin) {
      form.setValue("login", savedLogin);
      setLembrarUsuario(true);
    }
  }, [form]);

  useEffect(() => {
    if (token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

  const loginMutation = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      let rawBody = "";
      let data: unknown = null;

      try {
        rawBody = await response.text();
        try { data = JSON.parse(rawBody); } catch { data = null; }
      } catch { rawBody = ""; }

      if (!response.ok) {
        const errorMessage =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : rawBody || `Erro HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      if (!data) throw new Error("Resposta inválida do servidor de autenticação");
      return data as LoginResponse;
    },
    onSuccess: (data) => {
      login({ token: data.token, usuario: data.usuario });
      toast({ title: "Login realizado com sucesso" });
      navigate("/", { replace: true });
    },
    onError: (error) => {
      toast({
        title: "Erro ao fazer login",
        description: error instanceof Error ? error.message : "Falha ao fazer login",
        variant: "destructive",
      });
    },
  });

  const recuperarSenhaMutation = useMutation({
    mutationFn: async (loginUsuario: string) => {
      const response = await fetch("/api/auth/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginUsuario }),
      });

      let data: unknown;
      try { data = await response.json(); } catch { data = null; }

      if (!response.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao recuperar senha";
        throw new Error(msg);
      }

      return data as { senha_temporaria: string };
    },
    onSuccess: (data) => {
      setSenhaTemporaria(data.senha_temporaria);
    },
    onError: (error) => {
      toast({
        title: "Erro ao recuperar senha",
        description: error instanceof Error ? error.message : "Usuário não encontrado",
        variant: "destructive",
      });
    },
  });

  function abrirEsqueciSenha() {
    setLoginRecuperacao(form.getValues("login"));
    setSenhaTemporaria(null);
    setDialogEsqueciAberto(true);
  }

  function fecharDialogEsqueci() {
    setDialogEsqueciAberto(false);
    setSenhaTemporaria(null);
    setLoginRecuperacao("");
  }

  function handleRecuperarSenha() {
    if (!loginRecuperacao.trim()) {
      toast({ title: "Informe o login", description: "Digite seu login para recuperar a senha.", variant: "destructive" });
      return;
    }
    recuperarSenhaMutation.mutate(loginRecuperacao.trim());
  }

  function usarSenhaTemporaria() {
    if (senhaTemporaria) {
      form.setValue("senha", senhaTemporaria);
      fecharDialogEsqueci();
    }
  }

  function onSubmit(values: LoginFormValues) {
    if (lembrarUsuario) {
      localStorage.setItem("sislote:savedLogin", values.login);
    } else {
      localStorage.removeItem("sislote:savedLogin");
    }
    loginMutation.mutate(values);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-background/80">
      <div className="w-full max-w-md glass-card rounded-xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SISLOTE</h1>
          <p className="text-sm text-muted-foreground">Acesse o sistema com seu usuário</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Login</FormLabel>
                  <FormControl>
                    <Input autoComplete="username" placeholder="Seu usuário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="senha"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Senha</FormLabel>
                    <button
                      type="button"
                      onClick={abrirEsqueciSenha}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={mostrarSenha ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Sua senha"
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {mostrarSenha ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="lembrar" 
                checked={lembrarUsuario}
                onCheckedChange={(checked) => setLembrarUsuario(checked as boolean)}
              />
              <label
                htmlFor="lembrar"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Lembrar meu usuário
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Form>
      </div>

      {/* Dialog - Esqueci minha senha */}
      <Dialog open={dialogEsqueciAberto} onOpenChange={(open) => { if (!open) fecharDialogEsqueci(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              {senhaTemporaria
                ? "Uma senha temporária foi gerada. Use-a para acessar o sistema e depois altere em Configurações."
                : "Informe seu login para gerar uma senha temporária de acesso."}
            </DialogDescription>
          </DialogHeader>

          {!senhaTemporaria ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Login</label>
                <Input
                  placeholder="Seu login de acesso"
                  value={loginRecuperacao}
                  onChange={(e) => setLoginRecuperacao(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRecuperarSenha(); }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={fecharDialogEsqueci}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleRecuperarSenha}
                  disabled={recuperarSenhaMutation.isPending || !loginRecuperacao.trim()}
                >
                  {recuperarSenhaMutation.isPending ? "Verificando..." : "Gerar senha temporária"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Senha temporária</p>
                <p className="text-2xl font-bold tracking-widest font-mono text-primary">
                  {senhaTemporaria}
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Anote esta senha. Após o login, acesse <strong>Configurações → Usuários</strong> para alterá-la.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={fecharDialogEsqueci}>
                  Fechar
                </Button>
                <Button onClick={usarSenhaTemporaria}>
                  Usar esta senha
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
