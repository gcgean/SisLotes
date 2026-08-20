import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { Sparkles, Send, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

interface PropostaPendente {
  ferramenta: string;
  tipoProposta: string;
  dados: Record<string, unknown>;
}

interface AcaoExecutada {
  ferramenta: string;
  id?: number;
  resumo: Record<string, unknown>;
}

interface RespostaAssistente {
  resposta: string;
  acoesExecutadas: AcaoExecutada[];
  propostas: PropostaPendente[];
  ferramentasUsadas: string[];
}

interface Mensagem {
  papel: "usuario" | "assistente";
  conteudo: string;
  acoes?: AcaoExecutada[];
  propostas?: PropostaPendente[];
}

const SUGESTOES = [
  "Quanto tenho a receber por loteamento?",
  "Qual o saldo das minhas contas?",
  "Quais contas estão atrasadas?",
  "Lance uma despesa de energia de R$ 300 vencendo dia 10",
];

const moeda = (v: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

function fmtData(iso: unknown) {
  const s = String(iso ?? "");
  const [a, m, d] = s.split("-");
  return a && m && d ? `${d}/${m}/${a}` : s;
}

/** Resumo legível da proposta, para o usuário conferir antes de confirmar. */
function ResumoProposta({ proposta }: { proposta: PropostaPendente }) {
  const d = proposta.dados;
  if (proposta.tipoProposta === "conta_a_pagar") {
    return (
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Descrição</dt>
        <dd className="font-medium">{String(d.descricao ?? "—")}</dd>
        <dt className="text-muted-foreground">Valor</dt>
        <dd className="font-medium">{moeda(d.valor_total)}</dd>
        <dt className="text-muted-foreground">1º vencimento</dt>
        <dd className="font-medium">{fmtData(d.data_primeiro_vencimento)}</dd>
        <dt className="text-muted-foreground">Parcelas</dt>
        <dd className="font-medium">{String(d.numero_parcelas ?? 1)}</dd>
      </dl>
    );
  }
  return <pre className="text-[11px] overflow-x-auto">{JSON.stringify(d, null, 2)}</pre>;
}

/** Resumo do que foi efetivamente gravado. */
function ResumoAcao({ acao }: { acao: AcaoExecutada }) {
  const r = acao.resumo;
  const linhas: [string, string][] = [];
  if (r.descricao) linhas.push(["Descrição", String(r.descricao)]);
  if (r.valorTotal) linhas.push(["Valor", String(r.valorTotal)]);
  if (r.valor) linhas.push(["Valor", String(r.valor)]);
  if (r.parcelas) linhas.push(["Parcelas", String(r.parcelas)]);
  if (r.conta) linhas.push(["Conta", String(r.conta)]);
  if (r.primeiroVencimento) linhas.push(["1º vencimento", fmtData(r.primeiroVencimento)]);
  if (r.data) linhas.push(["Data", fmtData(r.data)]);

  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {linhas.map(([rot, val]) => (
        <FragmentoLinha key={rot} rotulo={rot} valor={val} />
      ))}
    </dl>
  );
}

function FragmentoLinha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </>
  );
}

export function AssistenteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery<{ configurado: boolean; provedor: string | null }>({
    queryKey: ["assistente", "status"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/assistente/status", { headers });
      if (!r.ok) throw new Error("Erro ao verificar o assistente");
      return r.json();
    },
  });

  useEffect(() => {
    if (open) requestAnimationFrame(() => fimRef.current?.scrollIntoView({ block: "end" }));
  }, [open, mensagens]);

  const perguntar = useMutation({
    mutationFn: async (pergunta: string) => {
      // Envia só o histórico textual — propostas não voltam para o modelo.
      const historico = mensagens.slice(-10).map((m) => ({ papel: m.papel, conteudo: m.conteudo }));
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers,
        body: JSON.stringify({ pergunta, historico }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo?.error ?? "Erro ao falar com o assistente");
      return corpo as RespostaAssistente;
    },
    onSuccess: (data) => {
      setMensagens((m) => [
        ...m,
        {
          papel: "assistente",
          conteudo: data.resposta,
          acoes: data.acoesExecutadas,
          propostas: data.propostas,
        },
      ]);
      // Dados mudaram: força as telas abertas a recarregar.
      if (data.acoesExecutadas?.length) {
        qc.invalidateQueries({ queryKey: ["despesas"] });
        qc.invalidateQueries({ queryKey: ["financeiro"] });
      }
    },
    onError: (e) => {
      toast({
        title: "Erro no assistente",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  function enviar(pergunta: string) {
    const p = pergunta.trim();
    if (!p || perguntar.isPending) return;
    setMensagens((m) => [...m, { papel: "usuario", conteudo: p }]);
    setTexto("");
    perguntar.mutate(p);
  }

  /** Leva o usuário para a tela onde o registro criado aparece. */
  function abrirTelaDaAcao(acao: AcaoExecutada) {
    onOpenChange(false);
    navigate(acao.ferramenta === "criar_conta_a_pagar" ? "/despesas?tab=despesas" : "/despesas?tab=lancamentos");
  }

  /** Ação crítica: sai do chat e vai para a tela real, com o formulário preenchido. */
  function revisarProposta(proposta: PropostaPendente) {
    if (proposta.tipoProposta === "conta_a_pagar") {
      const params = new URLSearchParams({ tab: "despesas", nova: "1" });
      Object.entries(proposta.dados).forEach(([k, v]) => {
        if (v !== null && v !== undefined) params.set(k, String(v));
      });
      onOpenChange(false);
      navigate(`/despesas?${params.toString()}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistente
          </DialogTitle>
          <DialogDescription>
            Consulta seus dados e executa cadastros por você. Ações irreversíveis (estorno, exclusão,
            fechamento) continuam exigindo sua confirmação.
          </DialogDescription>
        </DialogHeader>

        {status && !status.configurado ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <span>O assistente ainda não foi configurado neste servidor.</span>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-[280px] max-h-[420px] overflow-y-auto rounded-md border border-border p-3 space-y-3">
              {mensagens.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-muted-foreground">Comece por uma destas perguntas:</p>
                  <div className="flex flex-col gap-1.5 items-center">
                    {SUGESTOES.map((s) => (
                      <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => enviar(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {mensagens.map((m, i) => (
                <div key={i} className={`flex ${m.papel === "usuario" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.papel === "usuario" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.conteudo}</div>

                    {m.acoes?.map((a, j) => (
                      <div
                        key={`acao-${j}`}
                        className="mt-2 rounded-md border border-emerald-300 bg-background p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Gravado no sistema
                        </div>
                        <ResumoAcao acao={a} />
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5 h-8"
                          onClick={() => abrirTelaDaAcao(a)}
                        >
                          Ver na tela <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}

                    {m.propostas?.map((p, j) => (
                      <div key={j} className="mt-2 rounded-md border border-amber-300 bg-background p-2.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-500">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Aguardando sua confirmação
                        </div>
                        <ResumoProposta proposta={p} />
                        <Button size="sm" className="w-full gap-1.5 h-8" onClick={() => revisarProposta(p)}>
                          Revisar e confirmar <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {perguntar.isPending && <LoadingState message="Consultando seus dados…" />}
              <div ref={fimRef} />
            </div>

            <div className="space-y-2">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar(texto);
                  }
                }}
                placeholder="Pergunte alguma coisa… (Enter envia, Shift+Enter quebra linha)"
                className="min-h-[70px]"
                disabled={perguntar.isPending}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  A IA executa cadastros por você e pode errar — confira o que ela gravar.
                </span>
                <Button size="sm" onClick={() => enviar(texto)} disabled={!texto.trim() || perguntar.isPending}>
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Enviar
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botão que abre o assistente; só aparece se o servidor tiver IA configurada. */
export function AssistenteBotao() {
  const { token } = useAuth();
  const [aberto, setAberto] = useState(false);

  const { data: status } = useQuery<{ configurado: boolean }>({
    queryKey: ["assistente", "status"],
    queryFn: async () => {
      const r = await fetch("/api/assistente/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return { configurado: false };
      return r.json();
    },
  });

  if (!status?.configurado) return null;

  return (
    <>
      <Button
        size="sm"
        className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-sm shadow-violet-500/30 border-0"
        onClick={() => setAberto(true)}
      >
        <Sparkles className="h-4 w-4 animate-pulse" />
        <span className="hidden sm:inline">Assistente</span>
        <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-white/20 text-white border-0">
          beta
        </Badge>
      </Button>
      <AssistenteDialog open={aberto} onOpenChange={setAberto} />
    </>
  );
}
