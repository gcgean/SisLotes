import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: "",
      senha: "",
    },
  });

  useEffect(() => {
    if (token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

  const loginMutation = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      let rawBody = "";
      let data: unknown = null;

      try {
        rawBody = await response.text();
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = null;
        }
      } catch {
        rawBody = "";
      }

      if (!response.ok) {
        const errorMessage =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : rawBody || `Erro HTTP ${response.status}`;

        throw new Error(errorMessage);
      }

      if (!data) {
        throw new Error("Resposta inválida do servidor de autenticação");
      }

      return data as LoginResponse;
    },
    onSuccess: (data) => {
      login({
        token: data.token,
        usuario: data.usuario,
      });

      toast({ title: "Login realizado com sucesso" });
      navigate("/", { replace: true });
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : "Falha ao fazer login";

      toast({
        title: "Erro ao fazer login",
        description,
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: LoginFormValues) {
    loginMutation.mutate(values);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-background/80">
      <div className="w-full max-w-md glass-card rounded-xl p-8 space-y-6">
        <div className="space-y-2 text-center">
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
                    <Input autoComplete="username" {...field} />
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
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              Entrar
            </Button>
          </form>
        </Form>

        <p className="text-xs text-muted-foreground text-center">
          No ambiente de desenvolvimento, se o usuário não existir será criado automaticamente como
          master.
        </p>
      </div>
    </div>
  );
};

export default Login;
