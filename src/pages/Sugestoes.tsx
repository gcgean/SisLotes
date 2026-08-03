import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Paperclip, Send, X } from "lucide-react";
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

async function parseErrorMessage(response: Response, fallback: string) {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }
  return fallback;
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
  anexo_nome: string | null;
  anexo_base64: string | null;
  created_at: string;
  updated_at: string;
  usuario: SugestaoUsuario | null;
  total_mensagens?: number;
}

interface SugestaoMensagem {
  id_mensagem: number;
  id_sugestao: number;
  autor_admin: boolean;
  mensagem: string | null;
  anexo_nome: string | null;
  anexo_base64: string | null;
  created_at: string;
  usuario: SugestaoUsuario | null;
}

interface SugestaoDetalhe extends Sugestao {
  mensagens: SugestaoMensagem[];
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

function AnexoChip({ nome, base64 }: { nome: string | null; base64: string | null }) {
  if (!nome || !base64) return null;
  const isPdf = base64.startsWith("data:application/pdf");
  return (
    <a
      href={base64}
      target="_blank"
      rel="noreferrer"
      download={nome}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <Paperclip className="h-3 w-3" />
      {isPdf ? "PDF: " : ""}
      {nome}
    </a>
  );
}

const Sugestoes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = !!user?.user_master || user?.login?.toLowerCase() === "gcgean";

  const [tab, setTab] = useState("enviar");
  const [adminStatus, setAdminStatus] = useState<"all" | SugestaoStatus>("all");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminPage, setAdminPage] = useState(1);

  const [chatAberto, setChatAberto] = useState(false);
  const [chatId, setChatId] = useState<number | null>(null);

  // ─── Formulário de envio (com anexo opcional) ────────────────────────────
  const [anexoNome, setAnexoNome] = useState("");
  const [anexoBase64, setAnexoBase64] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SugestaoFormValues>({
    resolver: zodResolver(sugestaoSchema),
    defaultValues: { titulo: "", descricao: "" },
  });

  function handleAnexoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAnexoNome(file.name);
      setAnexoBase64(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function limparAnexo() {
    setAnexoNome("");
    setAnexoBase64("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const criarSugestaoMutation = useMutation({
    mutationFn: async (values: SugestaoFormValues) => {
      const response = await fetch("/api/sugestoes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          ...values,
          anexo_nome: anexoNome || null,
          anexo_base64: anexoBase64 || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, "Erro ao enviar sugestão"));
      }
      return response.json();
    },
    onSuccess: () => {
      form.reset({ titulo: "", descricao: "" });
      limparAnexo();
      toast({ title: "Sugestão enviada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["sugestoes-admin"] });
      queryClient.invalidateQueries({ queryKey: ["sugestoes-minhas"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar sugestão",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // ─── Minhas sugestões (todos os usuários acompanham o status) ────────────
  const { data: minhasSugestoes, isLoading: carregandoMinhas } = useQuery<Sugestao[]>({
    queryKey: ["sugestoes-minhas"],
    queryFn: async () => {
      const response = await fetch("/api/sugestoes/minhas", { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error("Erro ao carregar suas sugestões");
      return response.json();
    },
  });

  // ─── Lista administrativa (apenas gestor da plataforma) ──────────────────
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

  const sugestoes = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function abrirChat(id: number) {
    setChatId(id);
    setChatAberto(true);
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sugestões</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie sugestões de melhoria, anexe arquivos e converse diretamente com o gestor do sistema.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className={isAdmin ? "grid grid-cols-3 w-full max-w-lg" : "grid grid-cols-2 w-full max-w-md"}>
            <TabsTrigger value="enviar">Enviar</TabsTrigger>
            <TabsTrigger value="minhas">Minhas sugestões</TabsTrigger>
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

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Anexo (opcional)</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleAnexoChange}
                        className="text-sm file:text-xs max-w-xs"
                      />
                      {anexoNome && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground truncate max-w-[160px]">{anexoNome}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={limparAnexo}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={criarSugestaoMutation.isPending}>
                      {criarSugestaoMutation.isPending ? "Enviando..." : "Enviar sugestão"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </TabsContent>

          <TabsContent value="minhas" className="pt-4">
            <div className="glass-card rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Título</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Data</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Mensagens</th>
                      <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {carregandoMinhas && (
                      <tr>
                        <td colSpan={5} className="px-5 py-6 text-center text-sm text-muted-foreground">
                          Carregando suas sugestões...
                        </td>
                      </tr>
                    )}
                    {!carregandoMinhas &&
                      (minhasSugestoes ?? []).map((s) => (
                        <tr key={s.id_sugestao} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 font-medium">
                            <div className="max-w-[420px] truncate">{s.titulo}</div>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {formatDateTimeBR(s.created_at, s.created_at)}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={statusVariant(s.status)}>{statusLabel(s.status)}</Badge>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{s.total_mensagens ?? 0}</td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="outline" size="sm" onClick={() => abrirChat(s.id_sugestao)}>
                              Ver conversa
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {!carregandoMinhas && (minhasSugestoes ?? []).length === 0 && (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Você ainda não enviou nenhuma sugestão
                </div>
              )}
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
                      {!isLoading &&
                        !isError &&
                        sugestoes.map((s) => (
                          <tr key={s.id_sugestao} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3 font-medium">
                              <div className="flex items-center gap-2 max-w-[520px]">
                                <span className="truncate">{s.titulo}</span>
                                {s.anexo_nome && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">{s.usuario?.login ?? "—"}</td>
                            <td className="px-5 py-3 text-muted-foreground">
                              {formatDateTimeBR(s.created_at, s.created_at)}
                            </td>
                            <td className="px-5 py-3">
                              <Badge variant={statusVariant(s.status)}>{statusLabel(s.status)}</Badge>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Button variant="outline" size="sm" onClick={() => abrirChat(s.id_sugestao)}>
                                Ver / Responder
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
                    <span>
                      Página {adminPage} de {totalPages}
                    </span>
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

        <SugestaoChatDialog
          id={chatId}
          open={chatAberto}
          isAdmin={isAdmin}
          onOpenChange={(open) => {
            setChatAberto(open);
            if (!open) setChatId(null);
          }}
        />
      </div>
    </AppLayout>
  );
};

// ─── Dialog de chat: usado por usuário comum e pelo gestor da plataforma ────
function SugestaoChatDialog({
  id,
  open,
  isAdmin,
  onOpenChange,
}: {
  id: number | null;
  open: boolean;
  isAdmin: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [novoStatus, setNovoStatus] = useState<SugestaoStatus>("aberta");
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [anexoNome, setAnexoNome] = useState("");
  const [anexoBase64, setAnexoBase64] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: sugestao, isLoading } = useQuery<SugestaoDetalhe>({
    queryKey: ["sugestao-detalhe", id],
    enabled: open && id !== null,
    queryFn: async () => {
      const response = await fetch(`/api/sugestoes/${id}`, { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error("Erro ao carregar sugestão");
      return response.json();
    },
  });

  useEffect(() => {
    if (sugestao) setNovoStatus(sugestao.status);
  }, [sugestao?.status, sugestao]);

  useEffect(() => {
    if (open && sugestao?.mensagens) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    }
  }, [open, sugestao?.mensagens]);

  function handleAnexoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAnexoNome(file.name);
      setAnexoBase64(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function limparAnexo() {
    setAnexoNome("");
    setAnexoBase64("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const enviarMensagemMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sugestoes/${id}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          mensagem: mensagemTexto.trim() || undefined,
          anexo_nome: anexoNome || null,
          anexo_base64: anexoBase64 || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, "Erro ao enviar mensagem"));
      }
      return response.json();
    },
    onSuccess: () => {
      setMensagemTexto("");
      limparAnexo();
      queryClient.invalidateQueries({ queryKey: ["sugestao-detalhe", id] });
      queryClient.invalidateQueries({ queryKey: ["sugestoes-admin"] });
      queryClient.invalidateQueries({ queryKey: ["sugestoes-minhas"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const atualizarStatusMutation = useMutation({
    mutationFn: async (status: SugestaoStatus) => {
      const response = await fetch(`/api/sugestoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, "Erro ao atualizar status"));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status atualizado" });
      queryClient.invalidateQueries({ queryKey: ["sugestao-detalhe", id] });
      queryClient.invalidateQueries({ queryKey: ["sugestoes-admin"] });
      queryClient.invalidateQueries({ queryKey: ["sugestoes-minhas"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{sugestao?.titulo ?? "Conversa"}</DialogTitle>
        </DialogHeader>

        {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>}

        {sugestao && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="text-xs text-muted-foreground">
              {sugestao.usuario?.login ?? "—"} · {formatDateTimeBR(sugestao.created_at, sugestao.created_at)}
            </div>

            {isAdmin && (
              <div className="w-full max-w-[220px]">
                <Select
                  value={novoStatus}
                  onValueChange={(v) => {
                    const status = v as SugestaoStatus;
                    setNovoStatus(status);
                    atualizarStatusMutation.mutate(status);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="em_analise">Em análise</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isAdmin && (
              <div>
                <Badge variant={statusVariant(sugestao.status)}>{statusLabel(sugestao.status)}</Badge>
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex-1 min-h-[260px] max-h-[360px] overflow-y-auto rounded-md border border-border p-3"
            >
              <div className="space-y-3">
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <div className="whitespace-pre-wrap">{sugestao.descricao}</div>
                  {sugestao.anexo_nome && (
                    <div className="mt-2">
                      <AnexoChip nome={sugestao.anexo_nome} base64={sugestao.anexo_base64} />
                    </div>
                  )}
                </div>

                {sugestao.mensagens.map((m) => (
                  <div key={m.id_mensagem} className={`flex ${m.autor_admin ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.autor_admin ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <div className="text-[11px] opacity-70 mb-0.5">
                        {m.autor_admin ? "Gestor do sistema" : m.usuario?.login ?? "Usuário"} ·{" "}
                        {formatDateTimeBR(m.created_at, m.created_at)}
                      </div>
                      {m.mensagem && <div className="whitespace-pre-wrap">{m.mensagem}</div>}
                      {m.anexo_nome && (
                        <div className="mt-1">
                          <AnexoChip nome={m.anexo_nome} base64={m.anexo_base64} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {sugestao.mensagens.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-4">
                    Nenhuma mensagem ainda. Envie a primeira.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Textarea
                value={mensagemTexto}
                onChange={(e) => setMensagemTexto(e.target.value)}
                placeholder="Escreva uma mensagem..."
                className="min-h-[70px]"
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleAnexoChange}
                    className="text-xs file:text-xs max-w-[220px] h-8"
                  />
                  {anexoNome && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{anexoNome}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={limparAnexo}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => enviarMensagemMutation.mutate()}
                  disabled={
                    enviarMensagemMutation.isPending || (!mensagemTexto.trim() && !anexoBase64)
                  }
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {enviarMensagemMutation.isPending ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Sugestoes;
