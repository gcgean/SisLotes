import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
import { Usuario } from "../../entities/Usuario";
import { HubBillingCharge } from "../../entities/HubBillingCharge";
import { HubBillingEvent } from "../../entities/HubBillingEvent";
import { AuthRequest, requireAuth } from "../../middleware/auth";
import { HubBillingService } from "../../services/HubBillingService";
import { getEffectiveFeatures } from "../../config/license-features";

export const hubBillingRouter = Router();

const createOrderSchema = z.object({
  payload: z.record(z.unknown()),
});

const createCheckoutSchema = z.object({
  payload: z.record(z.unknown()),
});

const chargesQuerySchema = z.object({
  originType: z.enum(["order", "subscription"]),
  originId: z.string().min(1),
});

const planoCheckoutSchema = z.object({
  planCode: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.enum(["pix", "boleto", "cartao"]),
  currency: z.string().default("BRL"),
  orderPayload: z.record(z.unknown()).optional(),
  checkoutPayload: z.record(z.unknown()).optional(),
});

const changePlanSchema = z.object({
  targetPlanCode: z.string().min(1),
  paymentMethod: z.enum(["pix", "boleto", "cartao"]).default("pix"),
  currency: z.string().default("BRL"),
  cycleDays: z.number().int().positive().default(30),
});

const PLAN_PRICES: Record<string, number> = {
  TESTE: 1,
  BASICO: 49.9,
  INTERMEDIARIO: 99.9,
};

const PLAN_CATALOG = [
  { code: "TESTE", title: "Plano Teste", amount: 1, description: "Experimente gratuitamente por 14 dias." },
  { code: "BASICO", title: "Básico", amount: 49.9, description: "Recursos essenciais para sua operação." },
  { code: "INTERMEDIARIO", title: "Intermediário", amount: 99.9, description: "Recursos avançados e suporte prioritário." },
];

function selectHubPlanForCode(args: {
  expectedCode: string;
  mappedId?: string;
  byCode: Record<string, Record<string, unknown>>;
  byId: Record<string, Record<string, unknown>>;
}) {
  const byCodePlan = args.byCode[args.expectedCode] ?? null;
  if (byCodePlan) return byCodePlan;

  if (!args.mappedId) return null;
  const mapped = args.byId[args.mappedId] ?? null;
  if (!mapped) return null;
  const mappedCode = typeof mapped.code === "string" ? mapped.code.toUpperCase() : "";
  return mappedCode === args.expectedCode ? mapped : null;
}

// Mapeamento para os UUIDs de plano no Hub Billing (em centavos)
function getHubPlanMap(): Record<string, { planId: string; amountCents: number }> {
  return {
    TESTE: {
      planId: process.env.HUB_BILLING_PLAN_TESTE || "",
      amountCents: 100,
    },
    BASICO: {
      planId: process.env.HUB_BILLING_PLAN_BASICO || "",
      amountCents: 4990,
    },
    INTERMEDIARIO: {
      planId: process.env.HUB_BILLING_PLAN_INTERMEDIARIO || "",
      amountCents: 9990,
    },
  };
}

hubBillingRouter.get("/planos-disponiveis", requireAuth, async (_req: AuthRequest, res) => {
  const map = getHubPlanMap();
  const productId = process.env.HUB_BILLING_PRODUCT_ID || "";

  let plansFromHubByCode: Record<string, Record<string, unknown>> = {};
  let plansFromHubById: Record<string, Record<string, unknown>> = {};
  let hubLoaded = false;
  if (productId) {
    try {
      const plansFromHub = await HubBillingService.getProductPlans(productId);
      hubLoaded = true;
      plansFromHubByCode = plansFromHub.reduce<Record<string, Record<string, unknown>>>((acc, item) => {
        const code = pickString(item, ["code"]);
        if (code) acc[code.toUpperCase()] = item;
        return acc;
      }, {});
      plansFromHubById = plansFromHub.reduce<Record<string, Record<string, unknown>>>((acc, item) => {
        const id = pickString(item, ["id", "planId"]);
        if (id) acc[id] = item;
        return acc;
      }, {});
    } catch (err) {
      console.warn("[Hub] Falha ao buscar planos em /products/:id/plans:", err instanceof Error ? err.message : err);
    }
  }

  const planos = PLAN_CATALOG.map((basePlan) => {
    const localPlanId = map[basePlan.code]?.planId || "";
    const hubPlan = selectHubPlanForCode({
      expectedCode: basePlan.code,
      mappedId: localPlanId,
      byCode: plansFromHubByCode,
      byId: plansFromHubById,
    });
    const hubStatus = hubPlan ? String(hubPlan.status ?? "").toLowerCase() : "";
    const hubActiveFlag = hubPlan ? hubPlan.isActive : undefined;
    const hubName = hubPlan ? pickString(hubPlan, ["name"]) : null;
    const hubDescription = hubPlan ? pickString(hubPlan, ["description"]) : null;
    const hubAmountRaw = hubPlan ? pickNumber(hubPlan, ["amount", "value", "amountCents"]) : null;
    const hubAmount =
      hubAmountRaw == null
        ? null
        : Number.isInteger(hubAmountRaw) && Math.abs(hubAmountRaw) >= 100
        ? hubAmountRaw / 100
        : hubAmountRaw;
    const hubPlanId = hubPlan ? pickString(hubPlan, ["id", "planId"]) : null;

    const activeByHubStatus = hubPlan ? hubStatus === "active" : null;
    const activeByHubFlag = hubPlan && typeof hubActiveFlag === "boolean" ? hubActiveFlag : null;
    const active = hubPlan
      ? activeByHubFlag != null
        ? activeByHubFlag
        : activeByHubStatus != null
        ? activeByHubStatus
        : Boolean(localPlanId)
      : hubLoaded
      ? false
      : Boolean(localPlanId);

    return {
      code: basePlan.code,
      title: hubName || basePlan.title,
      amount: hubAmount ?? basePlan.amount,
      description: hubDescription || (hubPlan ? `Plano ${hubName || basePlan.title}` : basePlan.description),
      active,
      planId: hubPlanId || localPlanId || null,
      source: hubPlan ? "hub" : "local_fallback",
      hubStatus: hubStatus || null,
    };
  });

  return res.json({ planos });
});

const subscriptionCheckoutSchema = z.object({
  planCode: z.string().min(1),
  paymentMethod: z.enum(["pix", "boleto", "cartao"]).default("pix"),
  currency: z.string().default("BRL"),
  cycle: z.string().default("monthly"),
  subscriptionPayload: z.record(z.unknown()).optional(),
  checkoutPayload: z.record(z.unknown()).optional(),
});

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function extractCheckoutArtifacts(checkoutObj: Record<string, unknown>) {
  const nestedCandidates = [
    checkoutObj,
    asRecord(checkoutObj.data),
    asRecord(checkoutObj.charge),
    asRecord(checkoutObj.payment),
    asRecord(checkoutObj.checkout),
    asRecord(checkoutObj.result),
  ].filter(Boolean) as Record<string, unknown>[];

  const pickAnyString = (keys: string[]) => {
    for (const candidate of nestedCandidates) {
      const found = pickString(candidate, keys);
      if (found) return found;
    }
    return null;
  };

  const pickAnyNumber = (keys: string[]) => {
    for (const candidate of nestedCandidates) {
      const found = pickNumber(candidate, keys);
      if (found != null) return found;
    }
    return null;
  };

  return {
    chargeId: pickAnyString(["chargeId", "id", "charge_id"]),
    status: pickAnyString(["status"]),
    amountRaw: pickAnyNumber(["amount", "value", "amountCents"]),
    checkoutUrl: pickAnyString([
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
    pixCode: pickAnyString([
      "pixCode",
      "pix_code",
      "pixCopyPaste",
      "pixCopiaECola",
      "copyPaste",
      "copy_paste",
      "qrCodeText",
      "qrcode_text",
      "pixPayload",
      "pix_payload",
    ]),
    pixQrCode: pickAnyString([
      "pixQrCode",
      "pix_qr_code",
      "qrCodeImage",
      "qr_code_image",
    ]),
  };
}

function toHubBillingType(method: "pix" | "boleto" | "cartao") {
  if (method === "cartao") return "CREDIT_CARD";
  return "PIX";
}

function normalizeCheckoutPayload(payload: { paymentMethod: "pix" | "boleto" | "cartao" }, extra?: Record<string, unknown>) {
  const billingType = toHubBillingType(payload.paymentMethod);
  const sanitizedExtra = { ...(extra ?? {}) } as Record<string, unknown>;
  // A API nova rejeita esses campos no checkout.
  delete sanitizedExtra.paymentMethod;
  delete sanitizedExtra.paymentMethodId;
  return {
    billingType,
    ...sanitizedExtra,
  };
}

async function findActiveSubscriptionIdForEmpresa(empresa: Empresa) {
  if (!empresa.hub_customer_id) return null;

  const licenses = await HubBillingService.getCustomerLicenses(empresa.hub_customer_id);
  const productId = (process.env.HUB_BILLING_PRODUCT_ID || empresa.hub_product_code || "").toLowerCase();
  const activeStatuses = new Set(["active", "trialing", "overdue"]);

  for (const raw of licenses) {
    const item = raw as Record<string, unknown>;
    const originType = String(item.origin_type ?? item.originType ?? "").toLowerCase();
    const status = String(item.status ?? "").toLowerCase();
    const itemProductId = String(item.product_id ?? item.productId ?? "").toLowerCase();
    const originId = String(item.origin_id ?? item.originId ?? "");

    if (originType !== "subscription") continue;
    if (!originId) continue;
    if (productId && itemProductId && itemProductId !== productId) continue;
    if (activeStatuses.has(status)) return originId;
  }

  return null;
}

function calculateProration(args: {
  currentPlan: string;
  targetPlan: string;
  currentEndDate?: Date | null;
  cycleDays?: number;
}) {
  const currentPrice = PLAN_PRICES[args.currentPlan.toUpperCase()] ?? 0;
  const targetPrice = PLAN_PRICES[args.targetPlan.toUpperCase()] ?? 0;
  const diff = targetPrice - currentPrice;
  const now = Date.now();
  const cycleDays = args.cycleDays ?? 30;
  const cycleMs = cycleDays * 24 * 60 * 60 * 1000;
  const endMs = args.currentEndDate?.getTime() ?? now + cycleMs;
  const remainingMs = Math.max(0, endMs - now);
  const ratio = Math.min(1, Math.max(0, remainingMs / cycleMs));
  const amount = Number((Math.max(0, diff) * ratio).toFixed(2));
  const credit = Number((Math.max(0, -diff) * ratio).toFixed(2));
  return {
    currentPrice,
    targetPrice,
    diff,
    ratio: Number(ratio.toFixed(4)),
    amountToCharge: amount,
    credit,
  };
}

async function createPlanCheckoutForEmpresa(params: {
  empresa: Empresa;
  chargeRepo: ReturnType<typeof AppDataSource.getRepository<HubBillingCharge>>;
  planCode: string;
  amount: number;
  paymentMethod: "pix" | "boleto" | "cartao";
  currency: string;
  orderPayload?: Record<string, unknown>;
  checkoutPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  originType?: "order" | "subscription";
}) {
  const hubProductId = process.env.HUB_BILLING_PRODUCT_ID || params.empresa.hub_product_code || "";
  const hubPlan = getHubPlanMap()[params.planCode.toUpperCase()];
  const amountCents = Math.round(params.amount * 100);

  const orderPayload = {
    customerId: params.empresa.hub_customer_id,
    // Payload mínimo aceito no /orders pela API nova
    productId: hubProductId || undefined,
    planId: hubPlan?.planId || undefined,
    amount: amountCents,
    ...(params.orderPayload ?? {}),
  };

  const order = await HubBillingService.createOrder(orderPayload);
  const orderObj = order as Record<string, unknown>;
  const orderId = pickString(orderObj, ["id", "orderId"]);

  if (!orderId) {
    throw new Error("Hub Billing não retornou orderId");
  }

  const checkout = await HubBillingService.createCheckout(
    orderId,
    normalizeCheckoutPayload({ paymentMethod: params.paymentMethod }, params.checkoutPayload),
  );
  const checkoutObj = checkout as Record<string, unknown>;
  const artifacts = extractCheckoutArtifacts(checkoutObj);
  const chargeId = artifacts.chargeId;
  const status = artifacts.status;
  const amountRaw = artifacts.amountRaw;
  const amount = normalizeHubAmount(amountRaw, params.amount);
  const checkoutUrl = artifacts.checkoutUrl;
  const pixCode = artifacts.pixCode;
  const pixQrCode = artifacts.pixQrCode;

  const localCharge = params.chargeRepo.create({
    id_empresa: params.empresa.id_empresa,
    origin_type: params.originType ?? "order",
    origin_id: orderId,
    order_id: orderId,
    subscription_id: params.originType === "subscription" ? orderId : null,
    charge_id: chargeId,
    status,
    amount: amount.toFixed(2),
    payload: {
      planCode: params.planCode,
      paymentMethod: params.paymentMethod,
      order: orderObj,
      checkout: checkoutObj,
      metadata: params.metadata ?? {},
    },
  });

  const saved = await params.chargeRepo.save(localCharge);

  return {
    orderId,
    chargeId,
    status,
    amount,
    checkoutUrl,
    pixCode,
    pixQrCode,
    localChargeId: saved.id_hub_charge,
  };
}

function toAmountString(value: number | null) {
  return value != null ? value.toFixed(2) : null;
}

function toAmountNumber(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHubAmount(amountRaw: number | null, fallback: number) {
  if (amountRaw == null || !Number.isFinite(amountRaw)) return fallback;
  if (Number.isInteger(amountRaw)) {
    const asReais = amountRaw;
    const asCentavos = amountRaw / 100;
    if (fallback > 0) {
      const diffReais = Math.abs(asReais - fallback);
      const diffCentavos = Math.abs(asCentavos - fallback);
      if (diffCentavos < diffReais) return asCentavos;
      if (diffReais < diffCentavos) return asReais;
    }
    if (Math.abs(amountRaw) >= 100) return asCentavos;
  }
  return amountRaw;
}

function parsePlanCodeFromChargePayload(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return null;
  const directPlan = typeof payload.planCode === "string" ? payload.planCode : null;
  if (directPlan) return directPlan.toUpperCase();

  const metadata = asRecord(payload.metadata);
  const targetPlan = metadata && typeof metadata.targetPlan === "string" ? metadata.targetPlan : null;
  if (targetPlan) return targetPlan.toUpperCase();

  const order = asRecord(payload.order);
  const plan = order ? asRecord(order.plan) : null;
  const orderPlanCode = plan && typeof plan.code === "string" ? plan.code : null;
  if (orderPlanCode) return orderPlanCode.toUpperCase();

  return null;
}

/**
 * Garante que a empresa possui um hub_customer_id.
 * Se não tiver, cria o cliente no Hub Billing (ou recupera se já existir via 409)
 * e salva o ID na empresa antes de retornar.
 */
async function ensureHubCustomer(
  empresa: Empresa,
  empresaRepo: ReturnType<typeof AppDataSource.getRepository<Empresa>>,
): Promise<string> {
  if (empresa.hub_customer_id) {
    return empresa.hub_customer_id;
  }

  const docClean = (empresa.cnpj || "").replace(/\D/g, "");
  if (!docClean) {
    throw new Error("CNPJ/CPF da empresa não informado — impossível criar cliente no Hub Billing");
  }

  const personType = docClean.length === 11 ? "PF" : "PJ";
  const productCode = process.env.HUB_BILLING_PRODUCT_CODE || "SISLOTE_NOVO_OFICIAL_2";

  // Se a empresa não tem email, busca do usuário master
  let emailParaHub = empresa.email?.trim() || null;
  if (!emailParaHub) {
    const master = await AppDataSource.getRepository(Usuario).findOne({
      where: { id_empresa: empresa.id_empresa, user_master: true },
    });
    emailParaHub = master?.email?.trim() || null;
  }

  if (!emailParaHub) {
    throw new Error("E-mail não configurado para a empresa — informe um e-mail para continuar");
  }

  let customerId: string | null = null;
  const normalizeCustomerId = (obj: Record<string, unknown>) => {
    if (typeof obj.customerId === "string") return obj.customerId;
    if (typeof obj.id === "string") return obj.id;
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
      const nested = obj.data as Record<string, unknown>;
      if (typeof nested.id === "string") return nested.id;
      if (typeof nested.customerId === "string") return nested.customerId;
    }
    return null;
  };

  try {
    if (!customerId) {
      const customer = await HubBillingService.resolveExternalCustomer(docClean);
      customerId = normalizeCustomerId(customer as Record<string, unknown>);
    }
  } catch (externalResolveErr) {
    const msgExternalResolve = externalResolveErr instanceof Error ? externalResolveErr.message : String(externalResolveErr);
    console.warn("[Hub] resolveExternalCustomer falhou, tentando fallback admin:", msgExternalResolve);
  }

  try {
    if (!customerId) {
      const customer = await HubBillingService.createCustomer({
        personType,
        legalName: empresa.razao_social || empresa.nome_fantasia,
        document: docClean,
        email: emailParaHub,
        phone: (empresa.telefone || "").replace(/\D/g, "") || undefined,
      });
      const obj = customer as Record<string, unknown>;
      customerId = typeof obj.id === "string" ? obj.id : null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 409 = cliente já existe → busca pelo documento
    if (msg.includes("409")) {
      try {
        const found = await HubBillingService.findCustomerByDocument(docClean);
        const obj = found as Record<string, unknown>;
        if (typeof obj.id === "string") {
          customerId = obj.id;
        } else if (Array.isArray(obj.data) && obj.data.length > 0) {
          const first = obj.data[0] as Record<string, unknown>;
          customerId = typeof first.id === "string" ? first.id : null;
        }
      } catch (findErr) {
        console.warn("[Hub] findCustomerByDocument falhou:", findErr instanceof Error ? findErr.message : findErr);
      }
    } else {
      throw err;
    }
  }

  if (!customerId) {
    throw new Error("Não foi possível criar ou localizar o cliente no Hub Billing");
  }

  empresa.hub_customer_id = customerId;
  if (!empresa.hub_product_code) {
    empresa.hub_product_code = process.env.HUB_BILLING_PRODUCT_ID || productCode;
  }
  await empresaRepo.save(empresa);

  return customerId;
}

hubBillingRouter.get("/license-status", requireAuth, async (req: AuthRequest, res) => {
  const idEmpresa = req.user?.id_empresa;
  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  const repo = AppDataSource.getRepository(Empresa);
  const empresa = await repo.findOne({ where: { id_empresa: idEmpresa } });

  if (!empresa) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  let syncResult: Awaited<ReturnType<typeof HubBillingService.syncEmpresaLicense>> | null = null;
  if (HubBillingService.isConfigured() && empresa.hub_customer_id) {
    try {
      syncResult = await HubBillingService.syncEmpresaLicense(empresa);
    } catch (err) {
      console.warn("[Hub] sync em /license-status falhou:", err instanceof Error ? err.message : err);
    }
  }

  // Calcular daysLeft com fallback em cascata: Hub sync → features salvas → hub_expires_at → data_vencimento
  const daysLeft = syncResult?.daysLeft ?? HubBillingService.getStoredDaysLeft(empresa) ?? (() => {
    const expiry = empresa.hub_expires_at
      ?? (empresa.data_vencimento ? new Date(empresa.data_vencimento + "T23:59:59") : null);
    if (!expiry) return null;
    const msLeft = expiry.getTime() - Date.now();
    return msLeft > 0 ? Math.ceil(msLeft / (1000 * 60 * 60 * 24)) : 0;
  })();

  // hub_expires_at com fallback para data_vencimento
  const effectiveHubExpiresAt = empresa.hub_expires_at
    ?? (empresa.data_vencimento ? new Date(empresa.data_vencimento + "T23:59:59") : null);

  return res.json({
    id_empresa: empresa.id_empresa,
    plano: empresa.plano,
    data_vencimento: empresa.data_vencimento,
    hub_customer_id: empresa.hub_customer_id,
    hub_product_code: empresa.hub_product_code,
    hub_license_status: empresa.hub_license_status,
    hub_license_reason: empresa.hub_license_reason,
    hub_expires_at: effectiveHubExpiresAt,
    hub_features: getEffectiveFeatures(empresa.plano, empresa.hub_features ?? {}),
    hub_last_sync: empresa.hub_last_sync,
    hub_configured: HubBillingService.isConfigured(),
    days_left: daysLeft,
    banner: syncResult?.banner ?? null,
    access_status: syncResult?.accessStatus ?? empresa.hub_license_status ?? null,
  });
});

hubBillingRouter.post("/sync-license", requireAuth, async (req: AuthRequest, res) => {
  const idEmpresa = req.user?.id_empresa;
  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  const repo = AppDataSource.getRepository(Empresa);
  const empresa = await repo.findOne({ where: { id_empresa: idEmpresa } });
  if (!empresa) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  try {
    const result = await HubBillingService.syncEmpresaLicense(empresa);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao sincronizar licença";
    return res.status(502).json({ error: message });
  }
});

hubBillingRouter.post("/orders", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = createOrderSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Payload inválido", issues: parseResult.error.issues });
  }

  try {
    const result = await HubBillingService.createOrder(parseResult.data.payload);
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar pedido no Hub Billing";
    return res.status(502).json({ error: message });
  }
});

hubBillingRouter.post("/orders/:orderId/checkout", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = createCheckoutSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Payload inválido", issues: parseResult.error.issues });
  }

  try {
    const result = await HubBillingService.createCheckout(req.params.orderId, parseResult.data.payload);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar checkout no Hub Billing";
    return res.status(502).json({ error: message });
  }
});

hubBillingRouter.get("/charges", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = chargesQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
  }

  try {
    const result = await HubBillingService.getCharges(parseResult.data.originType, parseResult.data.originId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar cobranças no Hub Billing";
    return res.status(502).json({ error: message });
  }
});

hubBillingRouter.get("/minhas-cobrancas", requireAuth, async (req: AuthRequest, res) => {
  const idEmpresa = req.user?.id_empresa;
  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  const repo = AppDataSource.getRepository(HubBillingCharge);
  const rows = await repo.find({
    where: { id_empresa: idEmpresa },
    order: { created_at: "DESC" },
    take: 30,
  });

  return res.json(rows);
});

hubBillingRouter.get("/timeline", requireAuth, async (req: AuthRequest, res) => {
  const idEmpresa = req.user?.id_empresa;
  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  const chargeId = typeof req.query.chargeId === "string" ? req.query.chargeId : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);

  const eventRepo = AppDataSource.getRepository(HubBillingEvent);
  const qb = eventRepo
    .createQueryBuilder("ev")
    .where("ev.id_empresa = :id_empresa", { id_empresa: idEmpresa })
    .orderBy("ev.created_at", "DESC")
    .take(limit);

  if (chargeId) {
    qb.andWhere("ev.charge_id = :chargeId", { chargeId });
  }

  const rows = await qb.getMany();
  return res.json(rows);
});

hubBillingRouter.post("/minhas-cobrancas/:id/sync", requireAuth, async (req: AuthRequest, res) => {
  const idEmpresa = req.user?.id_empresa;
  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  const chargeRepo = AppDataSource.getRepository(HubBillingCharge);
  const eventRepo = AppDataSource.getRepository(HubBillingEvent);
  const charge = await chargeRepo.findOne({
    where: { id_hub_charge: Number(req.params.id), id_empresa: idEmpresa },
  });

  if (!charge) {
    return res.status(404).json({ error: "Cobrança não encontrada" });
  }

  try {
    const result = await HubBillingService.getCharges(charge.origin_type, charge.origin_id);
    const payload = result as Record<string, unknown>;
    const list = Array.isArray(result)
      ? (result as Record<string, unknown>[])
      : Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>[])
      : Array.isArray(payload.items)
      ? (payload.items as Record<string, unknown>[])
      : [];

    const resolveStatus = (item: Record<string, unknown>) => {
      const explicit = pickString(item, ["status"]);
      if (explicit) return explicit;
      const paidAt = pickString(item, ["paidAt", "paid_at"]);
      if (paidAt) return "paid";
      const canceledAt = pickString(item, ["canceledAt", "canceled_at"]);
      if (canceledAt) return "canceled";
      return null;
    };

    const matched =
      list.find((item) => pickString(item, ["chargeId", "id", "externalChargeId", "external_charge_id"]) === charge.charge_id) ||
      list[0] ||
      null;

    if (matched) {
      const oldStatus = charge.status;
      const newStatus = resolveStatus(matched);
      const newAmount = pickNumber(matched, ["amount", "value"]);
      const planCode = parsePlanCodeFromChargePayload(charge.payload as Record<string, unknown> | null);
      const fallbackByPlan = planCode ? PLAN_PRICES[planCode] ?? null : null;
      const fallbackByCurrent = toAmountNumber(charge.amount);
      const normalizedAmount = normalizeHubAmount(newAmount, fallbackByPlan ?? fallbackByCurrent ?? 0);
      charge.status = newStatus ?? charge.status;
      charge.amount = toAmountString(normalizedAmount) ?? charge.amount;
      charge.payload = { ...(charge.payload ?? {}), sync: matched };
      await chargeRepo.save(charge);

      const event = eventRepo.create({
        id_empresa: idEmpresa,
        event_type: "payment.synced",
        event_source: "sync",
        charge_id: charge.charge_id,
        order_id: charge.order_id,
        subscription_id: charge.subscription_id,
        status: charge.status,
        amount: charge.amount,
        payload: {
          oldStatus,
          newStatus: charge.status,
          syncPayload: matched,
        },
      });
      await eventRepo.save(event);
    }

    return res.json(charge);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao sincronizar cobrança";
    return res.status(502).json({ error: message });
  }
});

hubBillingRouter.post("/planos/checkout", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = planoCheckoutSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Payload inválido", issues: parseResult.error.issues });
  }

  const idEmpresa = req.user?.id_empresa;
  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  const empresaRepo = AppDataSource.getRepository(Empresa);
  const chargeRepo = AppDataSource.getRepository(HubBillingCharge);
  const eventRepo = AppDataSource.getRepository(HubBillingEvent);

  const empresa = await empresaRepo.findOne({ where: { id_empresa: idEmpresa } });
  if (!empresa) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  try {
    await ensureHubCustomer(empresa, empresaRepo);
  } catch (autoErr) {
    const msg = autoErr instanceof Error ? autoErr.message : "Erro ao criar cliente no Hub Billing";
    return res.status(502).json({ error: msg });
  }

  const payload = parseResult.data;
  const productCode = payload.planCode || empresa.hub_product_code;

  if (!productCode) {
    return res.status(400).json({ error: "Hub Product Code não configurado para a empresa" });
  }

  try {
    const created = await createPlanCheckoutForEmpresa({
      empresa,
      chargeRepo,
      planCode: payload.planCode,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      currency: payload.currency,
      orderPayload: payload.orderPayload,
      checkoutPayload: payload.checkoutPayload,
      metadata: { mode: "new_plan_checkout" },
    });

    await eventRepo.save(eventRepo.create({
      id_empresa: empresa.id_empresa,
      event_type: "payment.checkout_created",
      event_source: "system",
      charge_id: created.chargeId,
      order_id: created.orderId,
      subscription_id: null,
      status: created.status ?? "created",
      amount: toAmountString(created.amount),
      payload: {
        planCode: payload.planCode,
      },
    }));

    return res.status(201).json({
      ok: true,
      ...created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar checkout do plano";
    return res.status(502).json({ error: message });
  }
});

hubBillingRouter.post("/planos/subscription/checkout", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = subscriptionCheckoutSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Payload inválido", issues: parseResult.error.issues });
  }

  const idEmpresa = req.user?.id_empresa;
  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  const empresaRepo = AppDataSource.getRepository(Empresa);
  const chargeRepo = AppDataSource.getRepository(HubBillingCharge);
  const eventRepo = AppDataSource.getRepository(HubBillingEvent);

  const empresa = await empresaRepo.findOne({ where: { id_empresa: idEmpresa } });
  if (!empresa) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  try {
    await ensureHubCustomer(empresa, empresaRepo);
  } catch (autoErr) {
    const msg = autoErr instanceof Error ? autoErr.message : "Erro ao criar cliente no Hub Billing";
    return res.status(502).json({ error: msg });
  }

  const payload = parseResult.data;
  const planCode = payload.planCode.toUpperCase();
  const hubProductId = process.env.HUB_BILLING_PRODUCT_ID || "";
  const hubPlanMap = getHubPlanMap();
  const hubPlan = hubPlanMap[planCode];

  if (!hubProductId) {
    return res.status(500).json({ error: "HUB_BILLING_PRODUCT_ID não configurado" });
  }
  if (!hubPlan?.planId) {
    return res.status(400).json({ error: `Plano '${planCode}' não mapeado para o Hub Billing` });
  }

  try {
    const subscription = await HubBillingService.createSubscription({
      customerId: empresa.hub_customer_id,
      productId: hubProductId,
      planId: hubPlan.planId,
      contractedAmount: hubPlan.amountCents,
      ...(payload.subscriptionPayload ?? {}),
    });

    const subscriptionObj = subscription as Record<string, unknown>;
    const subscriptionId = pickString(subscriptionObj, ["id", "subscriptionId"]);
    if (!subscriptionId) {
      return res.status(502).json({ error: "Hub Billing não retornou subscriptionId" });
    }

    const checkout = await HubBillingService.createSubscriptionCheckout(
      subscriptionId,
      normalizeCheckoutPayload({ paymentMethod: payload.paymentMethod }, payload.checkoutPayload),
    );

    const checkoutObj = checkout as Record<string, unknown>;
    const artifacts = extractCheckoutArtifacts(checkoutObj);
    const chargeId = artifacts.chargeId;
    const status = artifacts.status;
    const amountRaw = artifacts.amountRaw;
    const amount = normalizeHubAmount(amountRaw, hubPlan.amountCents / 100);
    const checkoutUrl = artifacts.checkoutUrl;
    const pixCode = artifacts.pixCode;
    const pixQrCode = artifacts.pixQrCode;

    const localCharge = chargeRepo.create({
      id_empresa: empresa.id_empresa,
      origin_type: "subscription",
      origin_id: subscriptionId,
      order_id: null,
      subscription_id: subscriptionId,
      charge_id: chargeId,
      status,
      amount: toAmountString(amount),
      payload: {
        mode: "subscription_checkout",
        planCode,
        subscription: subscriptionObj,
        checkout: checkoutObj,
      },
    });
    const saved = await chargeRepo.save(localCharge);

    await eventRepo.save(eventRepo.create({
      id_empresa: empresa.id_empresa,
      event_type: "subscription.checkout_created",
      event_source: "system",
      charge_id: chargeId,
      order_id: null,
      subscription_id: subscriptionId,
      status: status ?? "created",
      amount: toAmountString(amount),
      payload: { planCode },
    }));

    return res.status(201).json({
      ok: true,
      subscriptionId,
      chargeId,
      status,
      amount,
      checkoutUrl,
      pixCode,
      pixQrCode,
      localChargeId: saved.id_hub_charge,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Erro ao criar assinatura";
    // 409 = já tem assinatura ativa → informa de forma amigável
    if (raw.includes("409") || raw.toLowerCase().includes("já possui assinatura")) {
      return res.status(409).json({
        error: "Este cliente já possui uma assinatura ativa para este produto.",
        hint: "Use Upgrade/Downgrade para alterar o plano existente.",
      });
    }
    return res.status(502).json({ error: raw });
  }
});

hubBillingRouter.post("/planos/alterar", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = changePlanSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Payload inválido", issues: parseResult.error.issues });
  }

  const idEmpresa = req.user?.id_empresa;
  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  const empresaRepo = AppDataSource.getRepository(Empresa);
  const chargeRepo = AppDataSource.getRepository(HubBillingCharge);
  const eventRepo = AppDataSource.getRepository(HubBillingEvent);
  const empresa = await empresaRepo.findOne({ where: { id_empresa: idEmpresa } });
  if (!empresa) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  try {
    await ensureHubCustomer(empresa, empresaRepo);
  } catch (autoErr) {
    const msg = autoErr instanceof Error ? autoErr.message : "Erro ao criar cliente no Hub Billing";
    return res.status(502).json({ error: msg });
  }

  const payload = parseResult.data;
  const currentPlan = (empresa.plano || "BASICO").toUpperCase();
  const targetPlan = payload.targetPlanCode.toUpperCase();
  const isTrialConversion = currentPlan === "TESTE" && targetPlan !== "TESTE";
  const hubPlan = getHubPlanMap()[targetPlan];
  const proration = calculateProration({
    currentPlan,
    targetPlan,
    currentEndDate: empresa.hub_expires_at ?? null,
    cycleDays: payload.cycleDays,
  });

  if (targetPlan === currentPlan) {
    // Exceção: no trial do plano TESTE, permite gerar cobrança no plano atual
    // para o cliente converter imediatamente sem trocar de card.
    if (currentPlan === "TESTE") {
      try {
        const fullAmount = PLAN_PRICES[targetPlan] ?? 1;
        const created = await createPlanCheckoutForEmpresa({
          empresa,
          chargeRepo,
          planCode: targetPlan,
          amount: fullAmount,
          paymentMethod: payload.paymentMethod,
          currency: payload.currency,
          metadata: {
            mode: "trial_same_plan_checkout",
            currentPlan,
            targetPlan,
          },
        });

        return res.status(201).json({
          ok: true,
          changed: false,
          currentPlan,
          targetPlan,
          proration: {
            ...proration,
            ratio: 1,
            amountToCharge: fullAmount,
            credit: 0,
          },
          ...created,
          message: "Checkout do plano atual criado com sucesso",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao gerar checkout do plano atual";
        return res.status(502).json({ error: message });
      }
    }

    return res.json({
      ok: true,
      message: "Plano atual já é o selecionado",
      currentPlan,
      targetPlan,
      proration,
    });
  }

  // Fluxo oficial da documentação: se existir assinatura ativa/trialing/overdue,
  // altera plano na assinatura e gera checkout da própria assinatura.
  if (hubPlan?.planId) {
    try {
      const subscriptionId = await findActiveSubscriptionIdForEmpresa(empresa);
      if (subscriptionId) {
        try {
          await HubBillingService.changeSubscriptionPlan(subscriptionId, {
            planId: hubPlan.planId,
          });
        } catch (planErr) {
          // Compatibilidade com variações de payload em ambientes diferentes do Hub.
          await HubBillingService.changeSubscriptionPlan(subscriptionId, {
            targetPlanId: hubPlan.planId,
          });
        }

        const checkout = await HubBillingService.createSubscriptionCheckout(
          subscriptionId,
          normalizeCheckoutPayload({ paymentMethod: payload.paymentMethod }),
        );

        const checkoutObj = checkout as Record<string, unknown>;
        const artifacts = extractCheckoutArtifacts(checkoutObj);
        const chargeId = artifacts.chargeId;
        const status = artifacts.status;
        const checkoutUrl = artifacts.checkoutUrl;
        const pixCode = artifacts.pixCode;
        const pixQrCode = artifacts.pixQrCode;
        const amountRaw = artifacts.amountRaw;
        const fallbackAmount = isTrialConversion
          ? PLAN_PRICES[targetPlan] ?? 0
          : proration.amountToCharge;
        const amount = normalizeHubAmount(amountRaw, fallbackAmount);

        const saved = await chargeRepo.save(chargeRepo.create({
          id_empresa: empresa.id_empresa,
          origin_type: "subscription",
          origin_id: subscriptionId,
          order_id: null,
          subscription_id: subscriptionId,
          charge_id: chargeId,
          status,
          amount: toAmountString(amount),
          payload: {
            mode: "subscription_change_plan_checkout",
            currentPlan,
            targetPlan,
            subscriptionId,
            checkout: checkoutObj,
          },
        }));

        await eventRepo.save(eventRepo.create({
          id_empresa: empresa.id_empresa,
          event_type: "subscription.plan_change_checkout_created",
          event_source: "system",
          charge_id: chargeId,
          order_id: null,
          subscription_id: subscriptionId,
          status: status ?? "created",
          amount: toAmountString(amount),
          payload: {
            currentPlan,
            targetPlan,
            mode: "subscription_change_plan_checkout",
          },
        }));

        return res.status(201).json({
          ok: true,
          changed: false,
          currentPlan,
          targetPlan,
          proration,
          chargeId,
          status,
          amount,
          checkoutUrl,
          pixCode,
          pixQrCode,
          localChargeId: saved.id_hub_charge,
          subscriptionId,
          message: "Checkout de mudança de plano criado na assinatura existente",
        });
      }
    } catch (subFlowError) {
      console.warn(
        "[Hub] change-plan via assinatura falhou, usando fallback por pedido:",
        subFlowError instanceof Error ? subFlowError.message : subFlowError,
      );
    }
  }

  // Conversão de trial para plano pago: cobra valor cheio do plano alvo
  if (isTrialConversion) {
    try {
      const fullAmount = PLAN_PRICES[targetPlan] ?? 0;
      const created = await createPlanCheckoutForEmpresa({
        empresa,
        chargeRepo,
        planCode: targetPlan,
        amount: fullAmount,
        paymentMethod: payload.paymentMethod,
        currency: payload.currency,
        metadata: {
          mode: "trial_conversion",
          currentPlan,
          targetPlan,
        },
      });

      return res.status(201).json({
        ok: true,
        changed: false,
        currentPlan,
        targetPlan,
        proration: {
          ...proration,
          ratio: 1,
          amountToCharge: fullAmount,
          credit: 0,
        },
        ...created,
        message: "Checkout de conversão do trial criado com sucesso",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao converter trial";
      return res.status(502).json({ error: message });
    }
  }

  if (proration.amountToCharge <= 0) {
    const previousPlan = empresa.plano;
    empresa.plano = targetPlan;
    empresa.hub_cache_until = new Date();
    empresa.hub_last_sync = new Date();
    await empresaRepo.save(empresa);
    await eventRepo.save(eventRepo.create({
      id_empresa: empresa.id_empresa,
      event_type: "subscription.plan_changed",
      event_source: "system",
      charge_id: null,
      order_id: null,
      subscription_id: null,
      status: "changed",
      amount: null,
      payload: {
        mode: "downgrade_without_charge",
        previousPlan,
        targetPlan,
        proration,
      },
    }));
    return res.json({
      ok: true,
      changed: true,
      currentPlan,
      targetPlan,
      proration,
      message: "Downgrade aplicado sem cobrança adicional",
    });
  }

  try {
    const created = await createPlanCheckoutForEmpresa({
      empresa,
      chargeRepo,
      planCode: targetPlan,
      amount: proration.amountToCharge,
      paymentMethod: payload.paymentMethod,
      currency: payload.currency,
      metadata: {
        mode: "plan_change_proration",
        currentPlan,
        targetPlan,
        ratio: proration.ratio,
      },
    });

    return res.status(201).json({
      ok: true,
      changed: false,
      currentPlan,
      targetPlan,
      proration,
      ...created,
      message: "Checkout de proration criado para mudança de plano",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao alterar plano";
    return res.status(502).json({ error: message });
  }
});

hubBillingRouter.post("/webhook", async (req, res) => {
  const rawBody = ((req as { rawBody?: string }).rawBody ?? "").trim();
  const signature = req.header("X-Hub-Signature");

  if (!HubBillingService.verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Assinatura inválida" });
  }

  const bodySchema = z.object({
    id: z.string().optional(),
    type: z.string(),
    productId: z.string().optional(),
    customerId: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
    createdAt: z.string().optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Evento inválido", issues: parsed.error.issues });
  }

  const event = parsed.data;
  const webhookEventId = event.id ?? null;
  const customerId = event.customerId;

  // Idempotência: ignora evento já processado
  if (webhookEventId) {
    const eventRepo = AppDataSource.getRepository(HubBillingEvent);
    const existing = await eventRepo.findOne({ where: { webhook_event_id: webhookEventId } });
    if (existing) {
      return res.status(200).json({ ok: true, duplicate: true });
    }
  }

  if (!customerId) {
    return res.status(200).json({ ok: true });
  }

  const repo = AppDataSource.getRepository(Empresa);
  const chargeRepo = AppDataSource.getRepository(HubBillingCharge);
  const eventRepo = AppDataSource.getRepository(HubBillingEvent);
  const empresa = await repo.findOne({ where: { hub_customer_id: customerId } });
  if (!empresa) {
    return res.status(200).json({ ok: true });
  }

  const payloadObj = (event.payload ?? {}) as Record<string, unknown>;
  const chargeId = pickString(payloadObj, ["chargeId", "id"]);
  const status = pickString(payloadObj, ["status"]);
  const amountRaw = pickNumber(payloadObj, ["amount", "value"]);
  const subscriptionId = pickString(payloadObj, ["subscriptionId", "subscription_id"]);
  let linkedCharge: HubBillingCharge | null = null;

  if (chargeId) {
    const existingCharge = await chargeRepo.findOne({
      where: { id_empresa: empresa.id_empresa, charge_id: chargeId },
      order: { created_at: "DESC" },
    });

    if (existingCharge) {
      const fallbackByPlan = (() => {
        const planCode = parsePlanCodeFromChargePayload(existingCharge.payload as Record<string, unknown> | null);
        return planCode ? PLAN_PRICES[planCode] ?? null : null;
      })();
      const fallbackByCurrent = toAmountNumber(existingCharge.amount);
      const normalizedAmount = normalizeHubAmount(amountRaw, fallbackByPlan ?? fallbackByCurrent ?? 0);
      existingCharge.status = status ?? existingCharge.status;
      existingCharge.amount = toAmountString(normalizedAmount) ?? existingCharge.amount;
      existingCharge.subscription_id = subscriptionId ?? existingCharge.subscription_id;
      existingCharge.payload = {
        ...(existingCharge.payload ?? {}),
        webhookEvent: event.type,
        webhookPayload: payloadObj,
      };
      await chargeRepo.save(existingCharge);
      linkedCharge = existingCharge;
    } else {
      const normalizedAmount = normalizeHubAmount(amountRaw, 0);
      const created = chargeRepo.create({
        id_empresa: empresa.id_empresa,
        origin_type: subscriptionId ? "subscription" : "order",
        origin_id: subscriptionId ?? chargeId,
        order_id: null,
        subscription_id: subscriptionId,
        charge_id: chargeId,
        status: status ?? event.type,
        amount: toAmountString(normalizedAmount),
        payload: {
          webhookEvent: event.type,
          webhookPayload: payloadObj,
        },
      });
      linkedCharge = await chargeRepo.save(created);
    }
  }

  const timelineAmount = normalizeHubAmount(amountRaw, toAmountNumber(linkedCharge?.amount) ?? 0);
  await eventRepo.save(eventRepo.create({
    id_empresa: empresa.id_empresa,
    event_type: event.type,
    event_source: "webhook",
    charge_id: chargeId,
    order_id: null,
    subscription_id: subscriptionId,
    status: status ?? event.type,
    amount: toAmountString(timelineAmount),
    payload: payloadObj,
    webhook_event_id: webhookEventId,
  }));

  if (event.type === "payment.approved") {
    empresa.hub_license_status = "licensed";
    empresa.hub_license_reason = null;
    // Força refresh imediato para buscar licença com vencimento completo no Hub.
    empresa.hub_cache_until = new Date(0);

    // Fallback local: aplica plano pago e ciclo completo a partir da confirmação.
    const paidPlan = parsePlanCodeFromChargePayload(linkedCharge?.payload);
    if (paidPlan) {
      const now = new Date();
      const fullCycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      empresa.plano = paidPlan;
      empresa.hub_expires_at = fullCycleEnd;
      empresa.data_vencimento = fullCycleEnd.toISOString().slice(0, 10);
    }

    try {
      await repo.save(empresa);
      await HubBillingService.syncEmpresaLicense(empresa);
    } catch (syncErr) {
      console.warn("[Hub] sync após payment.approved falhou:", syncErr instanceof Error ? syncErr.message : syncErr);
    }

    empresa.hub_last_sync = new Date();
    await repo.save(empresa);
    return res.status(200).json({ ok: true });
  } else if (event.type === "payment.failed" || event.type === "pix.expired") {
    empresa.hub_license_status = "license_suspended";
    empresa.hub_license_reason = event.type;
    empresa.hub_cache_until = new Date();
  } else if (event.type === "subscription.canceled" || event.type === "payment.chargeback") {
    empresa.hub_license_status = "license_revoked";
    empresa.hub_license_reason = event.type;
    empresa.hub_cache_until = new Date();
  }

  empresa.hub_last_sync = new Date();
  await repo.save(empresa);

  return res.status(200).json({ ok: true });
});
