import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { formatCpfCnpj } from "@/lib/cpfCnpj";
import { Building2, UserRound, CheckCircle2, ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";

// ─── Schemas ───────────────────────────────────────────────────────────────────
const usuarioSchema = z.object({
  login: z
    .string()
    .min(3, "Login deve ter pelo menos 3 caracteres")
    .regex(/^[a-zA-Z0-9._@-]+$/, "Use apenas letras, números e . _ @ -"),
  email: z
    .string()
    .email("E-mail inválido")
    .min(1, "E-mail é obrigatório para recuperação de acesso"),
  celular: z
    .string()
    .min(1, "Celular é obrigatório para recuperação de acesso"),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmarSenha: z.string(),
}).refine((d) => d.senha === d.confirmarSenha, {
  message: "As senhas não coincidem",
  path: ["confirmarSenha"],
});

const empresaSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome da empresa é obrigatório"),
  razao_social: z.string().optional(),
  cnpj: z
    .string()
    .min(1, "CPF ou CNPJ é obrigatório")
    .refine(
      (v) => { const d = v.replace(/\D/g, ""); return d.length === 11 || d.length === 14; },
      "Informe um CPF (000.000.000-00) ou CNPJ (00.000.000/0001-00) válido"
    ),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2, "Use a sigla do estado (ex: SP)").optional(),
  cep: z.string().optional(),
});

type UsuarioForm = z.infer<typeof usuarioSchema>;
type EmpresaForm = z.infer<typeof empresaSchema>;

// ─── Componente ────────────────────────────────────────────────────────────────
const PrimeiroAcesso = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [usuarioData, setUsuarioData] = useState<UsuarioForm | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const formUsuario = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: { login: "", email: "", celular: "", senha: "", confirmarSenha: "" },
  });

  const formEmpresa = useForm<EmpresaForm>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome_fantasia: "",
      razao_social: "",
      cnpj: "",
      telefone: "",
      endereco: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async ({
      empresa,
      usuario,
    }: {
      empresa: EmpresaForm;
      usuario: UsuarioForm;
    }) => {
      // Remove campos vazios da empresa
      const empresaLimpa = Object.fromEntries(
        Object.entries({ ...empresa, email: usuario.email })
          .filter(([, v]) => v !== "" && v !== undefined)
      );

      const response = await fetch("/api/setup/primeiro-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa: empresaLimpa,
          usuario: {
            login: usuario.login,
            senha: usuario.senha,
            email: usuario.email,
            telefone: usuario.celular,
          },
        }),
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Erro ${response.status}`;
        throw new Error(msg);
      }

      return data;
    },
    onSuccess: () => {
      setStep(3);
    },
    onError: (error) => {
      toast({
        title: "Erro ao cadastrar",
        description:
          error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  function handleUsuarioSubmit(values: UsuarioForm) {
    setUsuarioData(values);
    // Auto-preenche o telefone da empresa com o celular do usuário
    formEmpresa.setValue("telefone", values.celular);
    setStep(2);
  }

  function handleEmpresaSubmit(values: EmpresaForm) {
    if (!usuarioData) return;
    mutation.mutate({ empresa: values, usuario: usuarioData });
  }

  const passos = [
    { num: 1, label: "Usuário", icon: UserRound },
    { num: 2, label: "Empresa", icon: Building2 },
    { num: 3, label: "Concluído", icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-background/80 p-4">
      <div className="w-full max-w-lg glass-card rounded-xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SISLOTE</h1>
          <p className="text-sm text-muted-foreground">Configuração inicial — Primeiro Acesso</p>
        </div>

        {/* Indicador de passos */}
        <div className="flex items-center justify-center gap-2">
          {passos.map((p, i) => {
            const Icon = p.icon;
            const active = step === p.num;
            const done = step > p.num;
            return (
              <div key={p.num} className="flex items-center gap-2">
                <div
                  className={`flex flex-col items-center gap-1 ${
                    active
                      ? "text-primary"
                      : done
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all ${
                      active
                        ? "border-primary bg-primary/10"
                        : done
                        ? "border-green-600 bg-green-50 dark:bg-green-950/30"
                        : "border-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-medium hidden sm:block">{p.label}</span>
                </div>
                {i < passos.length - 1 && (
                  <div
                    className={`h-px w-10 sm:w-16 mx-1 ${
                      step > p.num ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ── PASSO 1: Usuário administrador ───────────────────────────── */}
        {step === 1 && (
          <Form {...formUsuario}>
            <form
              onSubmit={formUsuario.handleSubmit(handleUsuarioSubmit)}
              className="space-y-4"
            >
              <div>
                <h2 className="font-semibold text-base mb-1">Usuário Administrador</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  O e-mail e celular serão usados para recuperação de acesso.
                </p>
                <div className="space-y-3">
                  <FormField
                    control={formUsuario.control}
                    name="login"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Login <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="username"
                            placeholder="Seu nome de usuário"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={formUsuario.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              autoComplete="email"
                              placeholder="admin@empresa.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={formUsuario.control}
                      name="celular"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Celular <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              autoComplete="tel"
                              placeholder="(00) 90000-0000"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={formUsuario.control}
                    name="senha"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={mostrarSenha ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder="Mínimo 6 caracteres"
                              className="pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setMostrarSenha((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={formUsuario.control}
                    name="confirmarSenha"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar senha <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={mostrarConfirmar ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder="Repita a senha"
                              className="pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setMostrarConfirmar((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {mostrarConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Link to="/login">
                  <Button type="button" variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Login
                  </Button>
                </Link>
                <Button type="submit">
                  Próximo <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* ── PASSO 2: Dados da empresa ─────────────────────────────────── */}
        {step === 2 && (
          <Form {...formEmpresa}>
            <form
              onSubmit={formEmpresa.handleSubmit(handleEmpresaSubmit)}
              className="space-y-4"
            >
              <div>
                <h2 className="font-semibold text-base mb-3">Dados da Empresa</h2>
                <div className="space-y-3">
                  <FormField
                    control={formEmpresa.control}
                    name="nome_fantasia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da empresa <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Imobiliária ABC" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={formEmpresa.control}
                      name="razao_social"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Razão Social</FormLabel>
                          <FormControl>
                            <Input placeholder="Razão Social Ltda" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={formEmpresa.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF / CNPJ <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input
                              placeholder="000.000.000-00 ou 00.000.000/0001-00"
                              {...field}
                              onChange={(e) =>
                                field.onChange(formatCpfCnpj(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={formEmpresa.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(00) 90000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={formEmpresa.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua, número" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <FormField
                      control={formEmpresa.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem className="col-span-2 sm:col-span-1">
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Cidade" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={formEmpresa.control}
                      name="estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input placeholder="SP" maxLength={2} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={formEmpresa.control}
                      name="cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input placeholder="00000-000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Salvando..." : "Criar conta"}
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* ── PASSO 3: Sucesso ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="text-center space-y-4 py-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Tudo pronto!</h2>
              <p className="text-sm text-muted-foreground">
                Empresa{" "}
                <strong>{formEmpresa.getValues("nome_fantasia")}</strong> cadastrada
                com sucesso. Faça login para começar a usar o sistema.
              </p>
            </div>
            <Button
              className="w-full mt-2"
              onClick={() => navigate("/login", { replace: true })}
            >
              Ir para o Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrimeiroAcesso;
