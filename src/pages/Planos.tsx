import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

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
}

interface LicenseInfo {
  plano?: string | null;
  hub_license_status?: string | null;
  hub_license_reason?: string | null;
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

const PLANOS = [
  { code: "BASICO", title: "Básico", amount: 99 },
  { code: "PROFISSIONAL", title: "Profissional", amount: 199 },
  { code: "ENTERPRISE", title: "Enterprise", amount: 399 },
];

const Planos = () => {
  const [metodo, setMetodo] = useState<MetodoPagamento>("pix");
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
      return data as { checkoutUrl?: string; pixCode?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "minhas-cobrancas"] });
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "license-status"] });
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
      }
      if (data.pixCode) {
        navigator.clipboard.writeText(data.pixCode).catch(() => {});
        toast({ title: "PIX copiado para área de transferência" });
      }
      toast({ title: "Checkout criado com sucesso" });
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
      return data as { checkoutUrl?: string; pixCode?: string; message?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "minhas-cobrancas"] });
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "license-status"] });
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
      }
      if (data.pixCode) {
        navigator.clipboard.writeText(data.pixCode).catch(() => {});
        toast({ title: "PIX copiado para área de transferência" });
      }
      toast({ title: data.message || "Mudança de plano iniciada com sucesso" });
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Erro ao criar assinatura");
      }
      return data as { checkoutUrl?: string; pixCode?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "minhas-cobrancas"] });
      queryClient.invalidateQueries({ queryKey: ["hub-billing", "timeline"] });
      if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank");
      if (data.pixCode) {
        navigator.clipboard.writeText(data.pixCode).catch(() => {});
        toast({ title: "PIX copiado para área de transferência" });
      }
      toast({ title: "Checkout de assinatura criado com sucesso" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar assinatura",
        description: error instanceof Error ? error.message : "Falha inesperada",
        variant: "destructive",
      });
    },
  });

  const planoAtual = useMemo(() => licenca?.plano || "não definido", [licenca]);

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
            <Badge variant="outline" className="capitalize">Plano: {planoAtual}</Badge>
            <Badge variant={licenca?.hub_license_status === "active" ? "default" : "destructive"}>
              {licenca?.hub_license_status || "sem status"}
            </Badge>
            {licenca?.hub_license_reason && (
              <Badge variant="secondary">{licenca.hub_license_reason}</Badge>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Forma de pagamento:</span>
          <Select value={metodo} onValueChange={(v) => setMetodo(v as MetodoPagamento)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="cartao">Cartão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANOS.map((plano) => (
            <Card key={plano.code}>
              <CardHeader>
                <CardTitle>{plano.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">R$ {plano.amount.toFixed(2)}</p>
                <Button
                  className="w-full"
                  disabled={checkoutMutation.isPending || changePlanMutation.isPending || subscriptionMutation.isPending}
                  onClick={() => {
                    const planoAtualUpper = (licenca?.plano || "").toUpperCase();
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
                    : (licenca?.plano || "").toUpperCase() === plano.code
                    ? "Plano Atual"
                    : "Upgrade/Downgrade"}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={subscriptionMutation.isPending || checkoutMutation.isPending || changePlanMutation.isPending}
                  onClick={() =>
                    subscriptionMutation.mutate({
                      planCode: plano.code,
                      paymentMethod: metodo,
                    })
                  }
                >
                  {subscriptionMutation.isPending ? "Processando..." : "Assinatura recorrente"}
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
                      <Badge variant={row.status === "approved" ? "default" : "secondary"}>
                        {row.status || "pendente"}
                      </Badge>
                      <div>
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
                      <Badge variant={ev.status === "approved" ? "default" : "secondary"}>
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
