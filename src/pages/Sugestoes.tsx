import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTimeBR } from "@/lib/date-br";

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const sugestaoSchema = z.object({
  titulo: z.string().min(3, "Título é obrigatório").max(200),
  descricao: z.string().min(10, "Descrição é obrigatória").max(5000),
});

type SugestaoFormValues = z.infer<typeof sugestaoSchema>;

type SugestaoStatus = "aberta" | "em_analise" | "concluida";

interface SugestaoUsuario {
  id_usuario: number;
  login: string;
}

interface Sugestao {
  id_sugestao: number;
  id_empresa: number;
  titulo: string;
  descricao: string;
  status: SugestaoStatus;
  resposta_admin: string | null;
  created_at: string;
  updated_at: string;
  usuario: SugestaoUsuario | null;
}

interface ListaSugestoesResponse {
  data: Sugestao[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function statusLabel(status: SugestaoStatus) {
  if (status === "aberta") return "Aberta";
  if (status === "em_analise") return "Em análise";
  return "Concluída";
}

function statusVariant(status: SugestaoStatus) {
  if (status === "concluida") return "secondary";
  if (status === "em_analise") return "default";
  return "outline";
}

const Sugestoes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = !!user?.user_master || user?.login?.toLowerCase() === "gcgean";

  const [tab, setTab] = useState(isAdmin ? "enviar" : "enviar");
  const [adminStatus, setAdminStatus] = useState<"all" | SugestaoStatus>("all");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [sugestaoSelecionada, setSugestaoSelecionada] = useState<Sugestao | null>(null);
  const [respostaAdmin, setRespostaAdmin] = useState("");
  const [novoStatus, setNovoStatus] = useState<SugestaoStatus>("aberta");

  const form = useForm<SugestaoFormValues>({
    resolver: zodResolver(sugestaoSchema),
    defaultValues: { titulo: "", descricao: "" },
  });

  const criarSugestaoMutation = useMutation({
    mutationFn: async (values: SugestaoFormValues) => {
      const response = await fetch("/api/sugestoes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(values),
      });
      let data: unknown;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao enviar sugestão";
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: () => {
      form.reset({ titulo: "", descricao: "" });
      toast({ title: "Sugestão enviada com sucesso" });
      if (isAdmin) {
        queryClient.invalidateQueries({ queryKey: ["sugestoes-admin"] });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar sugestão",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(adminPage));
    params.set("limit", "20");
    if (adminStatus !== "all") params.set("status", adminStatus);
    if (adminSearch) params.set("search", adminSearch);
    return params;
  }, [adminPage, adminSearch, adminStatus]);

  const { data, isLoading, isError } = useQuery<ListaSugestoesResponse>({
    queryKey: ["sugestoes-admin", { adminPage, adminSearch, adminStatus }],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch(`/api/sugestoes?${queryParams.toString()}`, {
        headers: { ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error("Erro ao carregar sugestões");
      return response.json();
    },
  });

  const atualizarSugestaoMutation = useMutation({
    mutationFn: async (payload: { id_sugestao: number; status: SugestaoStatus; resposta_admin: string }) => {
      const response = await fetch(`/api/sugestoes/${payload.id_sugestao}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status: payload.status, resposta_admin: payload.resposta_admin }),
      });
      let data: unknown;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao atualizar sugestão";
        throw new Error(msg);
      }
      return data as Sugestao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sugestoes-admin"] });
      toast({ title: "Sugestão atualizada" });
      setDialogAberto(false);
      setSugestaoSelecionada(null);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar sugestão",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const sugestoes = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function abrirDetalhe(s: Sugestao) {
    setSugestaoSelecionada(s);
    setNovoStatus(s.status);
    setRespostaAdmin(s.resposta_admin ?? "");
    setDialogAberto(true);
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sugestões</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie sugestões de melhoria para o sistema.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className={isAdmin ? "grid grid-cols-2 w-full max-w-md" : "w-full max-w-md"}>
            <TabsTrigger value="enviar">Enviar</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin">Recebidas</TabsTrigger>}
          </TabsList>

          <TabsContent value="enviar" className="pt-4">
            <div className="glass-card rounded-lg p-5 max-w-2xl">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((values) => criarSugestaoMutation.mutate(values))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="titulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Sugestão para melhorar o cadastro de vendas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva a sugestão com detalhes..."
                            className="min-h-[140px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={criarSugestaoMutation.isPending}>
                      {criarSugestaoMutation.isPending ? "Enviando..." : "Enviar sugestão"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="pt-4 space-y-4">
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div className="flex-1 max-w-sm">
                  <Input
                    placeholder="Buscar por título/descrição..."
                    value={adminSearch}
                    onChange={(e) => {
                      setAdminSearch(e.target.value);
                      setAdminPage(1);
                    }}
                  />
                </div>

                <div className="w-full md:w-56">
                  <Select
                    value={adminStatus}
                    onValueChange={(v) => {
                      setAdminStatus(v as "all" | SugestaoStatus);
                      setAdminPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="em_analise">Em análise</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Título</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Usuário</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Data</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {isLoading && (
                        <tr>
                          <td colSpan={5} className="px-5 py-6 text-center text-sm text-muted-foreground">
                            Carregando sugestões...
                          </td>
                        </tr>
                      )}
                      {isError && !isLoading && (
                        <tr>
                          <td colSpan={5} className="px-5 py-6 text-center text-sm text-destructive">
                            Erro ao carregar sugestões
                          </td>
                        </tr>
                      )}
                      {!isLoading && !isError && sugestoes.map((s) => (
                        <tr key={s.id_sugestao} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 font-medium">
                            <div className="max-w-[520px] truncate">{s.titulo}</div>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {s.usuario?.login ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {formatDateTimeBR(s.created_at, s.created_at)}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={statusVariant(s.status)}>{statusLabel(s.status)}</Badge>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="outline" size="sm" onClick={() => abrirDetalhe(s)}>
                              Ver / Atualizar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!isLoading && !isError && sugestoes.length === 0 && (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    Nenhuma sugestão encontrada
                  </div>
                )}

                {!isLoading && !isError && totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                    <span>Página {adminPage} de {totalPages}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={adminPage <= 1}
                        onClick={() => setAdminPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={adminPage >= totalPages}
                        onClick={() => setAdminPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>

        <Dialog
          open={dialogAberto}
          onOpenChange={(open) => {
            setDialogAberto(open);
            if (!open) setSugestaoSelecionada(null);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da sugestão</DialogTitle>
            </DialogHeader>

            {sugestaoSelecionada && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">{sugestaoSelecionada.titulo}</div>
                  <div className="text-xs text-muted-foreground">
                    {sugestaoSelecionada.usuario?.login ?? "—"} ·{" "}
                    {formatDateTimeBR(sugestaoSelecionada.created_at, sugestaoSelecionada.created_at)}
                  </div>
                </div>

                <div className="rounded-md border border-border p-3 text-sm whitespace-pre-wrap">
                  {sugestaoSelecionada.descricao}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Status</div>
                    <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as SugestaoStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberta">Aberta</SelectItem>
                        <SelectItem value="em_analise">Em análise</SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Resposta do admin</div>
                  <Textarea
                    value={respostaAdmin}
                    onChange={(e) => setRespostaAdmin(e.target.value)}
                    className="min-h-[120px]"
                    placeholder="Opcional: registre uma resposta/encaminhamento..."
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogAberto(false)}>
                    Fechar
                  </Button>
                  <Button
                    onClick={() => {
                      atualizarSugestaoMutation.mutate({
                        id_sugestao: sugestaoSelecionada.id_sugestao,
                        status: novoStatus,
                        resposta_admin: respostaAdmin,
                      });
                    }}
                    disabled={atualizarSugestaoMutation.isPending}
                  >
                    {atualizarSugestaoMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Sugestoes;
