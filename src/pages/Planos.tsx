import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

type MetodoPagamento = "pix" | "boleto" | "cartao";

interface CobrancaLocal {
  id_hub_charge: number;
  charge_id: string | null;
  status: string | null;
  amount: string | null;
  created_at: string;
  payload?: Record<string, unknown> | null;
}

interface LicenseInfo {
  plano?: string | null;
  hub_license_status?: string | null;
  hub_license_reason?: string | null;
  hub_expires_at?: string | null;
  data_vencimento?: string | null;
}

interface PlanoCatalogo {
  code: string;
  title: string;
  amount: number;
  active?: boolean;
}

function fmtDate(date?: string | null) {
  if (!date) return null;
  try {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function extractPaymentData(raw: unknown) {
  const obj = asRecord(raw);
  if (!obj) return { checkoutUrl: null as string | null, pixCode: null as string | null, pixQrCode: null as string | null };

  const candidates = [
    obj,
    asRecord(obj.checkout),
    asRecord(obj.payment),
    asRecord(obj.data),
    asRecord(obj.result),
    asRecord(asRecord(obj.payload)?.checkout),
    asRecord(asRecord(obj.payload)?.payment),
  ].filter(Boolean) as Record<string, unknown>[];

  const pickAny = (keys: string[]) => {
    for (const c of candidates) {
      const val = pickString(c, keys);
      if (val) return val;
    }
    return null;
  };

  return {
    checkoutUrl: pickAny([
      "checkoutUrl",
      "checkout_url",
      "paymentUrl",
      "payment_url",
      "url",
      "invoiceUrl",
      "invoice_url",
      "paymentLink",
      "payment_link",
      "link",
    ]),
    pixCode: pickAny([
      "pixCode",
      "pix_code",
      "pixCopyPaste",
      "pixCopiaECola",
      "pixPayload",
      "pix_payload",
      "copyPaste",
      "copy_paste",
      "qrCodeText",
      "qrcode_text",
    ]),
    pixQrCode: pickAny([
      "pixQrCode",
      "pix_qr_code",
      "qrCodeImage",
      "qr_code_image",
    ]),
  };
}

interface TimelineEvent {
  id_hub_event: number;
  event_type: string;
  event_source: "webhook" | "sync" | "system";
  charge_id: string | null;
  status: string | null;
  amount: string | null;
  created_at: string;
}

function isSuccessfulChargeStatus(status?: string | null) {
  const normalized = (status || "").toLowerCase();
  return normalized === "approved" || normalized === "paid";
}

const PLANOS = [
  { code: "TESTE", title: "Plano Teste", amount: 1 },
  { code: "BASICO", title: "Básico", amount: 49.9 },
  { code: "INTERMEDIARIO", title: "Intermediário", amount: 99.9 },
];

const Planos = () => {
  const metodo: MetodoPagamento = "pix";
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPayment, setSelectedPayment] = useState<{
    chargeId: string;
    localChargeId?: number | null;
    checkoutUrl: string | null;
    pixCode: string | null;
    pixQrCode: string | null;
  } | null>(null);
  const [highlightPlanCode, setHighlightPlanCode] = useState<string | null>(null);
  const paymentButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const queryClient = useQueryClient();

  const { data: licenca } = useQuery<LicenseInfo>({
    queryKey: ["hub-billing", "license-status"],
    queryFn: async () => {
      const response = await fetch("/api/hub-billing/license-status", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) throw new Error("Erro ao carregar licença");
      return response.json();
    },
  });

  const { data: cobrancas = [] } = useQuery<CobrancaLocal[]>({
    queryKey: ["hub-billing", "minhas-cobrancas"],
    queryFn: async () => {
      const response = await fetch("/api/hub-billing/minhas-cobrancas", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) throw new Error("Erro ao carregar cobranças");
      return response.json();
    },
    refetchInterval: (query) => {
      const rows = (query.state.data as CobrancaLocal[] | undefined) ?? [];
      const hasPending = rows.some((row) =>
        ["pending", "processing", "created", "waiting_payment", "aberto"].includes((row.status || "").toLowerCase()),
      );
      return hasPending ? 5000 : 15000;
    },
  });

  const { data: timeline = [] } = useQuery<TimelineEvent[]>({
    queryKey: ["hub-billing", "timeline"],
    queryFn: async () => {
      const response = await fetch("/api/hub-billing/timeline?limit=80", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) throw new Error("Erro ao carregar timeline");
      return response.json();
    },
    refetchInterval: 5000,
  });

  const { data: planosDisponiveis } = useQuery<PlanoCatalogo[]>({
    queryKey: ["hub-billing", "planos-disponiveis"],
    queryFn: async () => {
      const response = await fetch("/api/hub-billing/planos-disponiveis", {
        headers: { ...getAuthHeaders() },
      });
      if (!response.ok) return PLANOS;
      const data = await response.json();
      const planos = Array.isArray((data as { planos?: unknown[] }).planos)
        ? ((data as { planos: PlanoCatalogo[] }).planos)
        : [];
      return planos.length > 0 ? planos : PLANOS;
    },
    staleTime: 60_000,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (payload: { planCode: string; amount: number; paymentMethod: MetodoPagamento }) => {
      const response = await fetch("/api/hub-billing/planos/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Erro ao gerar checkout");
      }
      return data as { checkoutUrl?: string; pixCode?: string; pixQrCode?: string; localChargeId?: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "minhas-cobrancas"] });
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "license-status"] });
      const payment = extractPaymentData(data);
      if (payment.checkoutUrl || payment.pixCode || payment.pixQrCode) {
        setSelectedPayment({
          chargeId: "nova-cobranca",
          localChargeId: typeof data.localChargeId === "number" ? data.localChargeId : null,
          checkoutUrl: payment.checkoutUrl,
          pixCode: payment.pixCode,
          pixQrCode: payment.pixQrCode,
        });
      }
      if (payment.checkoutUrl) {
        window.open(payment.checkoutUrl, "_blank");
      }
      if (payment.pixCode) {
        navigator.clipboard.writeText(payment.pixCode).catch(() => {});
        toast({ title: "PIX copiado para área de transferência" });
      }
      toast({
        title: payment.checkoutUrl || payment.pixCode
          ? "Checkout criado com sucesso"
          : "Cobrança criada. Use 'Cobranças recentes' para abrir o pagamento.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar checkout",
        description: error instanceof Error ? error.message : "Falha inesperada",
        variant: "destructive",
      });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async (payload: { targetPlanCode: string; paymentMethod: MetodoPagamento }) => {
      const response = await fetch("/api/hub-billing/planos/alterar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Erro ao alterar plano");
      }
      return data as { checkoutUrl?: string; pixCode?: string; pixQrCode?: string; message?: string; localChargeId?: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "minhas-cobrancas"] });
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "license-status"] });
      const payment = extractPaymentData(data);
      if (payment.checkoutUrl || payment.pixCode || payment.pixQrCode) {
        setSelectedPayment({
          chargeId: "nova-cobranca",
          localChargeId: typeof data.localChargeId === "number" ? data.localChargeId : null,
          checkoutUrl: payment.checkoutUrl,
          pixCode: payment.pixCode,
          pixQrCode: payment.pixQrCode,
        });
      }
      if (payment.checkoutUrl) {
        window.open(payment.checkoutUrl, "_blank");
      }
      if (payment.pixCode) {
        navigator.clipboard.writeText(payment.pixCode).catch(() => {});
        toast({ title: "PIX copiado para área de transferência" });
      }
      toast({
        title:
          data.message ||
          (payment.checkoutUrl || payment.pixCode
            ? "Mudança de plano iniciada com sucesso"
            : "Cobrança criada. Use 'Cobranças recentes' para abrir o pagamento."),
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao alterar plano",
        description: error instanceof Error ? error.message : "Falha inesperada",
        variant: "destructive",
      });
    },
  });

  const syncChargeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/hub-billing/minhas-cobrancas/${id}/sync`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Erro ao sincronizar cobrança");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "minhas-cobrancas"] });
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "license-status"] });
      toast({ title: "Cobrança sincronizada" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao sincronizar cobrança",
        description: error instanceof Error ? error.message : "Falha inesperada",
        variant: "destructive",
      });
    },
  });

  const subscriptionMutation = useMutation({
    mutationFn: async (payload: { planCode: string; paymentMethod: MetodoPagamento }) => {
      const response = await fetch("/api/hub-billing/planos/subscription/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        const message = data.error || "Erro ao criar assinatura";
        const lowerMessage = message.toLowerCase();
        const shouldFallbackToPlanChange =
          response.status === 409 ||
          response.status >= 500 ||
          lowerMessage.includes("já possui assinatura") ||
          lowerMessage.includes("internal_error");

        // Durante trial/assinatura ativa no Hub, ou em erro interno do Hub nesse fluxo,
        // faz fallback para checkout de mudança de plano.
        if (shouldFallbackToPlanChange) {
          const fallback = await fetch("/api/hub-billing/planos/alterar", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              targetPlanCode: payload.planCode,
              paymentMethod: payload.paymentMethod,
            }),
          });
          const fallbackData = await fallback.json().catch(() => ({}));
          if (!fallback.ok) {
            throw new Error((fallbackData as { error?: string }).error || message);
          }
          return { ...(fallbackData as Record<string, unknown>), mode: "plan_change_fallback" } as {
            checkoutUrl?: string;
            pixCode?: string;
            pixQrCode?: string;
            message?: string;
            mode?: string;
            localChargeId?: number;
          };
        }
        throw new Error(message);
      }
      return data as { checkoutUrl?: string; pixCode?: string; pixQrCode?: string; message?: string; mode?: string; localChargeId?: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "minhas-cobrancas"] });
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "license-status"] });
      const payment = extractPaymentData(data);
      if (payment.checkoutUrl || payment.pixCode || payment.pixQrCode) {
        setSelectedPayment({
          chargeId: "nova-cobranca",
          localChargeId: typeof data.localChargeId === "number" ? data.localChargeId : null,
          checkoutUrl: payment.checkoutUrl,
          pixCode: payment.pixCode,
          pixQrCode: payment.pixQrCode,
        });
      }
      if (payment.checkoutUrl) window.open(payment.checkoutUrl, "_blank");
      if (payment.pixCode) {
        navigator.clipboard.writeText(payment.pixCode).catch(() => {});
        toast({ title: "PIX copiado para área de transferência" });
      }
      if (data.mode === "plan_change_fallback") {
        toast({ title: data.message || "Checkout de upgrade criado com sucesso" });
      } else {
        toast({ title: "Checkout de assinatura criado com sucesso" });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Falha inesperada";
      toast({
        title: "Erro ao criar pagamento",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const planoAtual = useMemo(() => licenca?.plano || "não definido", [licenca]);
  const planoAtualUpper = useMemo(() => (licenca?.plano || "").toUpperCase(), [licenca?.plano]);
  const planoAtualLabel = useMemo(() => {
    if (!planoAtualUpper) return planoAtual;
    const match = (planosDisponiveis ?? []).find((p) => p.code.toUpperCase() === planoAtualUpper);
    return match?.title || planoAtual;
  }, [planoAtual, planoAtualUpper, planosDisponiveis]);
  const planosRender = useMemo(() => {
    const source = (planosDisponiveis && planosDisponiveis.length > 0 ? planosDisponiveis : PLANOS).map((p) => ({
      ...p,
      code: p.code.toUpperCase(),
    }));
    return source.filter((p) => p.active !== false || p.code === planoAtualUpper);
  }, [planosDisponiveis, planoAtualUpper]);

  useEffect(() => {
    const shouldFocusCurrentPayment = searchParams.get("payCurrent") === "1";
    if (!shouldFocusCurrentPayment) return;
    if (!planoAtualUpper) return;

    const target = paymentButtonRefs.current[planoAtualUpper];
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus();
    setHighlightPlanCode(planoAtualUpper);
    toast({ title: "Clique em Pagamento para gerar a cobrança do plano atual." });

    const next = new URLSearchParams(searchParams);
    next.delete("payCurrent");
    setSearchParams(next, { replace: true });

    const timeout = window.setTimeout(() => setHighlightPlanCode(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [planoAtualUpper, searchParams, setSearchParams]);

  useEffect(() => {
    let running = false;
    const syncPending = async () => {
      if (running) return;
      running = true;
      try {
        const pendentes = cobrancas
          .filter((row) => ["pending", "processing", "created", "waiting_payment", "aberto"].includes((row.status || "").toLowerCase()))
          .slice(0, 3);

        await Promise.all(
          pendentes.map((row) =>
            fetch(`/api/hub-billing/minhas-cobrancas/${row.id_hub_charge}/sync`, {
              method: "POST",
              headers: { ...getAuthHeaders() },
            }).catch(() => null),
          ),
        );

        if (pendentes.length > 0) {
          queryClient.invalidateQueries({ queryKey: ["hub-billing", "minhas-cobrancas"] });
          queryClient.invalidateQueries({ queryKey: ["hub-billing", "license-status"] });
        }
      } finally {
        running = false;
      }
    };

    syncPending();
    const interval = window.setInterval(syncPending, 5000);
    return () => window.clearInterval(interval);
  }, [cobrancas, queryClient]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assinatura, cobrança e status da licença da sua empresa
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Licença Atual</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-center">
            <Badge variant="outline" className="capitalize">
              Plano: {planoAtualLabel}
            </Badge>
            <Badge variant={licenca?.hub_license_status === "active" ? "default" : "destructive"}>
              {licenca?.hub_license_status || "sem status"}
            </Badge>
            {licenca?.hub_license_reason && (
              <Badge variant="secondary">{licenca.hub_license_reason}</Badge>
            )}
            {(licenca?.hub_expires_at || licenca?.data_vencimento) && (
              <span className="text-sm text-muted-foreground">
                Válido até{" "}
                <span className="font-medium text-foreground">
                  {fmtDate(licenca.hub_expires_at ?? licenca.data_vencimento)}
                </span>
              </span>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Forma de pagamento:</span>
          <Select value={metodo} disabled>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">PIX</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {planosRender.map((plano) => (
            <Card key={plano.code}>
              <CardHeader>
                <CardTitle>{plano.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">R$ {plano.amount.toFixed(2)}</p>
                <Button
                  className="w-full"
                  disabled={
                    checkoutMutation.isPending ||
                    changePlanMutation.isPending ||
                    subscriptionMutation.isPending ||
                    planoAtualUpper === plano.code
                  }
                  onClick={() => {
                    if (planoAtualUpper === plano.code) {
                      toast({
                        title: "Plano atual em uso",
                        description: "Escolha outro plano para fazer upgrade/downgrade.",
                      });
                      return;
                    }

                    if (planoAtualUpper && planoAtualUpper !== plano.code) {
                      changePlanMutation.mutate({
                        targetPlanCode: plano.code,
                        paymentMethod: metodo,
                      });
                      return;
                    }
                    checkoutMutation.mutate({
                      planCode: plano.code,
                      amount: plano.amount,
                      paymentMethod: metodo,
                    });
                  }}
                >
                  {checkoutMutation.isPending || changePlanMutation.isPending
                    ? "Processando..."
                    : planoAtualUpper === plano.code
                    ? "Plano Atual"
                    : "Upgrade/Downgrade"}
                </Button>
                <Button
                  ref={(el) => {
                    paymentButtonRefs.current[plano.code] = el;
                  }}
                  className="w-full"
                  variant="outline"
                  data-plan-code={plano.code}
                  data-current-plan-payment={planoAtualUpper === plano.code ? "1" : "0"}
                  data-highlighted={highlightPlanCode === plano.code ? "1" : "0"}
                  style={
                    highlightPlanCode === plano.code
                      ? { boxShadow: "0 0 0 2px rgba(16,185,129,.5) inset, 0 0 0 2px rgba(16,185,129,.35)" }
                      : undefined
                  }
                  disabled={subscriptionMutation.isPending || checkoutMutation.isPending || changePlanMutation.isPending}
                  onClick={() => {
                    subscriptionMutation.mutate({
                      planCode: plano.code,
                      paymentMethod: metodo,
                    });
                  }}
                >
                  {subscriptionMutation.isPending ? "Processando..." : "Pagamento"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cobranças recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {cobrancas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {cobrancas.map((row) => (
                  <div key={row.id_hub_charge} className="border rounded-md p-3 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium">Charge: {row.charge_id || "-"}</div>
                      <div className="text-muted-foreground">
                        {new Date(row.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="font-semibold">R$ {Number(row.amount || 0).toFixed(2)}</div>
                      <Badge variant={isSuccessfulChargeStatus(row.status) ? "default" : "secondary"}>
                        {row.status || "pendente"}
                      </Badge>
                      <div className="flex gap-2 justify-end">
                        {(() => {
                          const payment = extractPaymentData(row.payload);
                          return (
                            <>
                              {payment.checkoutUrl && (
                                <Button
                                  size="sm"
                                  onClick={() => window.open(payment.checkoutUrl as string, "_blank")}
                                >
                                  Abrir pagamento
                                </Button>
                              )}
                              {payment.pixCode && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    navigator.clipboard.writeText(payment.pixCode as string).catch(() => {});
                                    toast({ title: "PIX copiado para área de transferência" });
                                  }}
                                >
                                  Copiar PIX
                                </Button>
                              )}
                              {(payment.checkoutUrl || payment.pixCode || payment.pixQrCode) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setSelectedPayment({
                                      chargeId: row.charge_id || String(row.id_hub_charge),
                                      localChargeId: row.id_hub_charge,
                                      checkoutUrl: payment.checkoutUrl,
                                      pixCode: payment.pixCode,
                                      pixQrCode: payment.pixQrCode,
                                    })
                                  }
                                >
                                  Pagar agora
                                </Button>
                              )}
                            </>
                          );
                        })()}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncChargeMutation.mutate(row.id_hub_charge)}
                          disabled={syncChargeMutation.isPending}
                        >
                          Atualizar status
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={Boolean(selectedPayment)}
          onOpenChange={(open) => {
            if (!open && selectedPayment?.localChargeId) {
              fetch(`/api/hub-billing/minhas-cobrancas/${selectedPayment.localChargeId}/sync`, {
                method: "POST",
                headers: { ...getAuthHeaders() },
              })
                .catch(() => null)
                .finally(() => {
                  queryClient.invalidateQueries({ queryKey: ["hub-billing", "minhas-cobrancas"] });
                  queryClient.invalidateQueries({ queryKey: ["hub-billing", "license-status"] });
                });
            }
            if (!open) setSelectedPayment(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Pagamento da cobrança</DialogTitle>
              <DialogDescription>
                Charge: {selectedPayment?.chargeId || "-"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {selectedPayment?.checkoutUrl && (
                <Button className="w-full" onClick={() => window.open(selectedPayment.checkoutUrl as string, "_blank")}>
                  Abrir link de pagamento
                </Button>
              )}

              {selectedPayment?.pixQrCode && (
                <img
                  src={`data:image/png;base64,${selectedPayment.pixQrCode}`}
                  alt="QR Code PIX"
                  className="mx-auto max-h-72 w-auto rounded-md border"
                />
              )}

              {selectedPayment?.pixCode && (
                <>
                  <Textarea
                    readOnly
                    value={selectedPayment.pixCode}
                    className="min-h-[110px] text-xs font-mono"
                  />
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedPayment.pixCode as string).catch(() => {});
                      toast({ title: "PIX copiado para área de transferência" });
                    }}
                  >
                    Copiar código PIX
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Timeline de eventos</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento de cobrança registrado.</p>
            ) : (
              <div className="space-y-2">
                {timeline.map((ev) => (
                  <div key={ev.id_hub_event} className="border rounded-md p-3 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium">{ev.event_type}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(ev.created_at).toLocaleString("pt-BR")} • origem {ev.event_source}
                      </div>
                      {ev.charge_id && (
                        <div className="text-xs text-muted-foreground">Charge: {ev.charge_id}</div>
                      )}
                    </div>
                    <div className="text-right">
                      {ev.amount && <div className="font-semibold">R$ {Number(ev.amount).toFixed(2)}</div>}
                      <Badge variant={isSuccessfulChargeStatus(ev.status) ? "default" : "secondary"}>
                        {ev.status || "n/a"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Planos;
