import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
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
  BASICO: 99,
  PROFISSIONAL: 199,
  ENTERPRISE: 399,
};

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
  const orderPayload = {
    customerId: params.empresa.hub_customer_id,
    productCode: params.planCode,
    amount: params.amount,
    currency: params.currency,
    metadata: {
      id_empresa: params.empresa.id_empresa,
      nome_fantasia: params.empresa.nome_fantasia,
      ...(params.metadata ?? {}),
    },
    ...(params.orderPayload ?? {}),
  };

  const order = await HubBillingService.createOrder(orderPayload);
  const orderObj = order as Record<string, unknown>;
  const orderId = pickString(orderObj, ["id", "orderId"]);

  if (!orderId) {
    throw new Error("Hub Billing não retornou orderId");
  }

  const checkout = await HubBillingService.createCheckout(orderId, {
    paymentMethod: params.paymentMethod,
    ...(params.checkoutPayload ?? {}),
  });
  const checkoutObj = checkout as Record<string, unknown>;
  const chargeId = pickString(checkoutObj, ["chargeId", "id"]);
  const status = pickString(checkoutObj, ["status"]);
  const amount = pickNumber(checkoutObj, ["amount", "value"]) ?? params.amount;
  const checkoutUrl = pickString(checkoutObj, ["checkoutUrl", "checkout_url", "paymentUrl", "url"]);
  const pixCode = pickString(checkoutObj, ["pixCode", "pix_code", "pixCopyPaste"]);

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
    localChargeId: saved.id_hub_charge,
  };
}

function toAmountString(value: number | null) {
  return value != null ? value.toFixed(2) : null;
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

  return res.json({
    id_empresa: empresa.id_empresa,
    plano: empresa.plano,
    data_vencimento: empresa.data_vencimento,
    hub_customer_id: empresa.hub_customer_id,
    hub_product_code: empresa.hub_product_code,
    hub_license_status: empresa.hub_license_status,
    hub_license_reason: empresa.hub_license_reason,
    hub_expires_at: empresa.hub_expires_at,
    hub_features: getEffectiveFeatures(empresa.plano, empresa.hub_features ?? {}),
    hub_last_sync: empresa.hub_last_sync,
    hub_configured: HubBillingService.isConfigured(),
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
    const list = Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>[])
      : Array.isArray(payload.items)
      ? (payload.items as Record<string, unknown>[])
      : [];
    const matched =
      list.find((item) => pickString(item, ["chargeId", "id"]) === charge.charge_id) ||
      list[0] ||
      null;

    if (matched) {
      const oldStatus = charge.status;
      const newStatus = pickString(matched, ["status"]);
      const newAmount = pickNumber(matched, ["amount", "value"]);
      charge.status = newStatus ?? charge.status;
      charge.amount = toAmountString(newAmount) ?? charge.amount;
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

  if (!empresa.hub_customer_id) {
    return res.status(400).json({ error: "Hub Customer ID não configurado para a empresa" });
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
  if (!empresa.hub_customer_id) {
    return res.status(400).json({ error: "Hub Customer ID não configurado para a empresa" });
  }

  const payload = parseResult.data;
  const subscription = await HubBillingService.createSubscription({
    customerId: empresa.hub_customer_id,
    productCode: payload.planCode,
    cycle: payload.cycle,
    currency: payload.currency,
    ...(payload.subscriptionPayload ?? {}),
  });

  const subscriptionObj = subscription as Record<string, unknown>;
  const subscriptionId = pickString(subscriptionObj, ["id", "subscriptionId"]);
  if (!subscriptionId) {
    return res.status(502).json({ error: "Hub Billing não retornou subscriptionId" });
  }

  try {
    const checkout = await HubBillingService.createSubscriptionCheckout(subscriptionId, {
      paymentMethod: payload.paymentMethod,
      ...(payload.checkoutPayload ?? {}),
    });

    const checkoutObj = checkout as Record<string, unknown>;
    const chargeId = pickString(checkoutObj, ["chargeId", "id"]);
    const status = pickString(checkoutObj, ["status"]);
    const amount = pickNumber(checkoutObj, ["amount", "value"]);
    const checkoutUrl = pickString(checkoutObj, ["checkoutUrl", "checkout_url", "paymentUrl", "url"]);
    const pixCode = pickString(checkoutObj, ["pixCode", "pix_code", "pixCopyPaste"]);

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
        planCode: payload.planCode,
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
      payload: {
        planCode: payload.planCode,
      },
    }));

    return res.status(201).json({
      ok: true,
      subscriptionId,
      chargeId,
      status,
      amount,
      checkoutUrl,
      pixCode,
      localChargeId: saved.id_hub_charge,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar checkout de assinatura";
    return res.status(502).json({ error: message });
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
  if (!empresa.hub_customer_id) {
    return res.status(400).json({ error: "Hub Customer ID não configurado para a empresa" });
  }

  const payload = parseResult.data;
  const currentPlan = (empresa.plano || "BASICO").toUpperCase();
  const targetPlan = payload.targetPlanCode.toUpperCase();
  const proration = calculateProration({
    currentPlan,
    targetPlan,
    currentEndDate: empresa.hub_expires_at ?? null,
    cycleDays: payload.cycleDays,
  });

  if (targetPlan === currentPlan) {
    return res.json({
      ok: true,
      message: "Plano atual já é o selecionado",
      currentPlan,
      targetPlan,
      proration,
    });
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
    type: z.string(),
    customerId: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Evento inválido", issues: parsed.error.issues });
  }

  const event = parsed.data;
  const customerId = event.customerId;

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
  const amount = pickNumber(payloadObj, ["amount", "value"]);
  const subscriptionId = pickString(payloadObj, ["subscriptionId", "subscription_id"]);

  if (chargeId) {
    const existingCharge = await chargeRepo.findOne({
      where: { id_empresa: empresa.id_empresa, charge_id: chargeId },
      order: { created_at: "DESC" },
    });

    if (existingCharge) {
      existingCharge.status = status ?? existingCharge.status;
      existingCharge.amount = toAmountString(amount) ?? existingCharge.amount;
      existingCharge.subscription_id = subscriptionId ?? existingCharge.subscription_id;
      existingCharge.payload = {
        ...(existingCharge.payload ?? {}),
        webhookEvent: event.type,
        webhookPayload: payloadObj,
      };
      await chargeRepo.save(existingCharge);
    } else {
      const created = chargeRepo.create({
        id_empresa: empresa.id_empresa,
        origin_type: subscriptionId ? "subscription" : "order",
        origin_id: subscriptionId ?? chargeId,
        order_id: null,
        subscription_id: subscriptionId,
        charge_id: chargeId,
        status: status ?? event.type,
        amount: toAmountString(amount),
        payload: {
          webhookEvent: event.type,
          webhookPayload: payloadObj,
        },
      });
      await chargeRepo.save(created);
    }
  }

  await eventRepo.save(eventRepo.create({
    id_empresa: empresa.id_empresa,
    event_type: event.type,
    event_source: "webhook",
    charge_id: chargeId,
    order_id: null,
    subscription_id: subscriptionId,
    status: status ?? event.type,
    amount: toAmountString(amount),
    payload: payloadObj,
  }));

  if (event.type === "payment.approved") {
    empresa.hub_license_status = "active";
    empresa.hub_license_reason = null;
    empresa.hub_cache_until = new Date();
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
