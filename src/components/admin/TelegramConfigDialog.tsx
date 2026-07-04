import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, Trash2, RadioTower, Loader2, ExternalLink } from "lucide-react";

interface Recipient {
  nome: string;
  chat_id: string;
}

interface TelegramConfig {
  ativo: boolean;
  bot_token: string;
  notificar_novo_lead: boolean;
  notificar_pagamento: boolean;
  recipients: Recipient[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  token: string | null;
}

export function TelegramConfigDialog({ open, onClose, token }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [ativo, setAtivo] = useState(false);
  const [notificarNovoLead, setNotificarNovoLead] = useState(true);
  const [notificarPagamento, setNotificarPagamento] = useState(true);
  const [botToken, setBotToken] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  const { data, isLoading } = useQuery<TelegramConfig>({
    queryKey: ["admin-telegram"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/admin/telegram", { headers });
      if (!r.ok) throw new Error("Erro ao carregar configuração");
      return r.json();
    },
  });

  useEffect(() => {
    if (data) {
      setAtivo(data.ativo);
      setNotificarNovoLead(data.notificar_novo_lead);
      setNotificarPagamento(data.notificar_pagamento ?? true);
      setBotToken(data.bot_token || "");
      setRecipients(data.recipients?.length ? data.recipients : []);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          ativo,
          notificar_novo_lead: notificarNovoLead,
          notificar_pagamento: notificarPagamento,
          bot_token: botToken,
          recipients: recipients.filter((r) => r.chat_id.trim()),
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Erro ao salvar");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-telegram"] });
      toast({ title: "Configuração salva", description: "As notificações do Telegram foram atualizadas." });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const detectarMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/telegram/detectar", {
        method: "POST",
        headers,
        body: JSON.stringify({ bot_token: botToken }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao detectar");
      return j.chats as Recipient[];
    },
    onSuccess: (chats) => {
      if (!chats.length) {
        toast({
          title: "Nenhum chat encontrado",
          description: "Envie qualquer mensagem ao seu bot no Telegram e clique em Detectar novamente.",
        });
        return;
      }
      setRecipients((prev) => {
        const existentes = new Set(prev.map((r) => r.chat_id));
        const novos = chats.filter((c) => !existentes.has(c.chat_id));
        return [...prev, ...novos];
      });
      toast({ title: `${chats.length} chat(s) detectado(s)`, description: "Destinatários adicionados à lista." });
    },
    onError: (e: Error) => toast({ title: "Erro ao detectar", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      // Garante que a config atual está salva antes do teste
      await saveMutationSilent();
      const r = await fetch("/api/admin/telegram/test", { method: "POST", headers });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha no teste");
      return j;
    },
    onSuccess: (j: { enviados: number; total: number }) => {
      toast({ title: "Teste enviado", description: `Mensagem enviada para ${j.enviados}/${j.total} destinatário(s).` });
    },
    onError: (e: Error) => toast({ title: "Erro no teste", description: e.message, variant: "destructive" }),
  });

  async function saveMutationSilent() {
    const r = await fetch("/api/admin/telegram", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        ativo,
        notificar_novo_lead: notificarNovoLead,
        bot_token: botToken,
        recipients: recipients.filter((r) => r.chat_id.trim()),
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || "Erro ao salvar antes do teste");
    }
  }

  function addRecipient() {
    setRecipients((prev) => [...prev, { nome: "", chat_id: "" }]);
  }
  function updateRecipient(i: number, field: keyof Recipient, value: string) {
    setRecipients((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function removeRecipient(i: number) {
    setRecipients((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-sky-500" />
            Notificações via Telegram
          </DialogTitle>
          <DialogDescription>
            Receba um aviso no Telegram, com o telefone de contato, sempre que um novo lead se cadastrar na plataforma.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-5 pt-1">
            {/* Toggles */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Ativar notificações</p>
                <p className="text-xs text-muted-foreground">Liga/desliga todo o envio pelo Telegram.</p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Avisar sobre novos leads</p>
                <p className="text-xs text-muted-foreground">Envia mensagem quando uma nova empresa se cadastra.</p>
              </div>
              <Switch checked={notificarNovoLead} onCheckedChange={setNotificarNovoLead} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Avisar sobre pagamentos</p>
                <p className="text-xs text-muted-foreground">Envia mensagem quando um pagamento de assinatura é confirmado.</p>
              </div>
              <Switch checked={notificarPagamento} onCheckedChange={setNotificarPagamento} />
            </div>

            <Separator />

            {/* Bot token */}
            <div className="space-y-1.5">
              <Label className="text-sm">Token do Bot</Label>
              <Input
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCdef..."
                type="password"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Crie um bot no Telegram com o{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:underline inline-flex items-center gap-0.5"
                >
                  @BotFather <ExternalLink className="h-3 w-3" />
                </a>{" "}
                e cole o token aqui.
              </p>
            </div>

            <Separator />

            {/* Recipients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Destinatários</Label>
                  <p className="text-xs text-muted-foreground">Quem vai receber as notificações (você e os gestores).</p>
                </div>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => detectarMutation.mutate()}
                  disabled={!botToken.trim() || detectarMutation.isPending}
                  className="gap-1.5"
                >
                  {detectarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />}
                  Detectar
                </Button>
              </div>

              {recipients.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">
                  Nenhum destinatário. Adicione manualmente o <b>chat ID</b> ou clique em <b>Detectar</b> (após enviar
                  uma mensagem ao seu bot).
                </p>
              )}

              <div className="space-y-2">
                {recipients.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={r.nome}
                      onChange={(e) => updateRecipient(i, "nome", e.target.value)}
                      placeholder="Nome (ex: Gerente)"
                      className="flex-1"
                    />
                    <Input
                      value={r.chat_id}
                      onChange={(e) => updateRecipient(i, "chat_id", e.target.value)}
                      placeholder="Chat ID (ex: 123456789)"
                      className="flex-1"
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeRecipient(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addRecipient} className="gap-1.5">
                <Plus className="h-4 w-4" /> Adicionar destinatário
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button" variant="secondary"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !botToken.trim() || recipients.filter((r) => r.chat_id.trim()).length === 0}
            className="gap-1.5"
          >
            {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar teste
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
