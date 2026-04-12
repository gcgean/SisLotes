import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
import { Usuario } from "../../entities/Usuario";
import { HubBillingService } from "../../services/HubBillingService";

export const setupRouter = Router();

function allDigitsEqual(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (allDigitsEqual(digits)) return false;
  const nums = digits.split("").map((n) => Number(n));

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i] * (10 - i);
  let mod = sum % 11;
  const d1 = mod < 2 ? 0 : 11 - mod;
  if (nums[9] !== d1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += nums[i] * (11 - i);
  mod = sum % 11;
  const d2 = mod < 2 ? 0 : 11 - mod;
  if (nums[10] !== d2) return false;

  return true;
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14) return false;
  if (allDigitsEqual(digits)) return false;
  const nums = digits.split("").map((n) => Number(n));
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += nums[i] * w1[i];
  let mod = sum % 11;
  const d1 = mod < 2 ? 0 : 11 - mod;
  if (nums[12] !== d1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += nums[i] * w2[i];
  mod = sum % 11;
  const d2 = mod < 2 ? 0 : 11 - mod;
  if (nums[13] !== d2) return false;

  return true;
}

function isValidCpfCnpj(value: string): boolean {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

// ─── Planos disponíveis (rota pública) ────────────────────────────────────────
const PLANOS_DISPONIVEIS = [
  {
    code: "TESTE",
    title: "Plano Teste",
    amount: 1.0,
    description: "Experimente gratuitamente por 14 dias. Todos os recursos disponíveis.",
    isTrial: true,
  },
  {
    code: "BASICO",
    title: "Básico",
    amount: 49.9,
    description: "Ideal para pequenas imobiliárias. Recursos essenciais para gestão de lotes.",
  },
  {
    code: "INTERMEDIARIO",
    title: "Intermediário",
    amount: 99.9,
    description: "Para operações de médio porte. Recursos avançados e suporte prioritário.",
  },
];

function getTrialDaysConfigured() {
  const raw = Number(process.env.HUB_BILLING_TRIAL_DAYS ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 14;
}

async function getTrialDaysFromHub(productId: string) {
  const fallback = getTrialDaysConfigured();
  if (!productId) return fallback;
  try {
    const product = await HubBillingService.getProduct(productId);
    const trialRaw = (product as { trial_days?: unknown; trialDays?: unknown }).trial_days
      ?? (product as { trial_days?: unknown; trialDays?: unknown }).trialDays;
    const parsed =
      typeof trialRaw === "number"
        ? trialRaw
        : typeof trialRaw === "string" && trialRaw.trim() && !Number.isNaN(Number(trialRaw))
          ? Number(trialRaw)
          : null;
    if (parsed != null && Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  } catch (err) {
    console.warn("[Setup] Falha ao obter trial_days do produto no Hub:", err instanceof Error ? err.message : err);
  }
  return fallback;
}

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

setupRouter.get("/planos-disponiveis", async (_req, res) => {
  const planMap: Record<string, string> = {
    TESTE: process.env.HUB_BILLING_PLAN_TESTE || "",
    BASICO: process.env.HUB_BILLING_PLAN_BASICO || "",
    INTERMEDIARIO: process.env.HUB_BILLING_PLAN_INTERMEDIARIO || "",
  };

  const productId = process.env.HUB_BILLING_PRODUCT_ID || "";
  // Quando Hub não está configurado, mostra todos os planos disponíveis sem filtro
  const fallbackPlanos = productId
    ? PLANOS_DISPONIVEIS.filter((plan) => Boolean(planMap[plan.code]))
    : PLANOS_DISPONIVEIS;

  const trialDays = await getTrialDaysFromHub(productId);
  const responseWithFallback = () => res.json({ planos: fallbackPlanos, trialDays });
  if (!productId) return responseWithFallback();

  try {
    const plansFromHub = await HubBillingService.getProductPlans(productId);
    const byCode = plansFromHub.reduce<Record<string, Record<string, unknown>>>((acc, item) => {
      const code = typeof item.code === "string" ? item.code.toUpperCase() : "";
      if (code) acc[code] = item;
      return acc;
    }, {});
    const byId = plansFromHub.reduce<Record<string, Record<string, unknown>>>((acc, item) => {
      const id = typeof item.id === "string" ? item.id : "";
      if (id) acc[id] = item;
      return acc;
    }, {});

    const planos = PLANOS_DISPONIVEIS.map((plan) => {
      const mappedId = planMap[plan.code];
      const hubPlan = selectHubPlanForCode({
        expectedCode: plan.code,
        mappedId,
        byCode,
        byId,
      });
      if (!hubPlan) return null;

      const hubStatus = typeof hubPlan.status === "string" ? hubPlan.status.toLowerCase() : "";
      const active =
        typeof hubPlan.isActive === "boolean"
          ? hubPlan.isActive
          : hubStatus
          ? hubStatus === "active"
          : false;
      if (!active) return null;

      const name = typeof hubPlan.name === "string" && hubPlan.name.trim() ? hubPlan.name : plan.title;
      const hubDescription =
        typeof hubPlan.description === "string" && hubPlan.description.trim()
          ? hubPlan.description
          : null;
      const amountRaw =
        typeof hubPlan.amount === "number"
          ? hubPlan.amount
          : typeof hubPlan.amount === "string" && hubPlan.amount.trim() && !Number.isNaN(Number(hubPlan.amount))
          ? Number(hubPlan.amount)
          : plan.amount;
      const amount =
        Number.isInteger(amountRaw) && Math.abs(amountRaw) >= 100
          ? amountRaw / 100
          : Number(amountRaw);

      return {
        ...plan,
        title: name,
        description: hubDescription || `Plano ${name}`,
        amount: Number.isFinite(amount) ? amount : plan.amount,
      };
    }).filter(Boolean);

    if (planos.length > 0) {
      return res.json({ planos, trialDays });
    }
    // Hub não retornou planos ativos — usa fallback (ou todos os planos se fallback vazio)
    return res.json({ planos: fallbackPlanos.length > 0 ? fallbackPlanos : PLANOS_DISPONIVEIS, trialDays });
  } catch (err) {
    console.warn("[Setup] Falha ao buscar planos no Hub:", err instanceof Error ? err.message : err);
    // Em caso de falha na API do Hub, usa fallback (ou todos os planos se fallback vazio)
    return res.json({ planos: fallbackPlanos.length > 0 ? fallbackPlanos : PLANOS_DISPONIVEIS, trialDays });
  }
});

// ─── Status: sistema já tem empresas? (rota pública) ─────────────────────────
setupRouter.get("/status", async (_req, res) => {
  try {
    const empresaRepo = AppDataSource.getRepository(Empresa);
    const totalEmpresas = await empresaRepo.count();
    return res.json({ totalEmpresas });
  } catch (error) {
    console.error("Erro ao verificar status do setup:", error);
    return res.status(500).json({ error: "Erro ao verificar status" });
  }
});

// ─── Schema de validação ──────────────────────────────────────────────────────
const primeiroAcessoSchema = z.object({
  empresa: z.object({
    nome_fantasia: z.string().min(1, "Nome da empresa é obrigatório").max(200),
    razao_social: z.string().max(200).optional(),
    cnpj: z
      .string()
      .min(1, "CPF/CNPJ é obrigatório")
      .refine((v) => isValidCpfCnpj(v), "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido"),
    ie: z.string().max(20).optional(),
    endereco: z.string().max(300).optional(),
    bairro: z.string().max(100).optional(),
    cidade: z.string().max(100).optional(),
    estado: z.string().max(2).optional(),
    cep: z.string().max(9).optional(),
    telefone: z.string().max(20).optional(),
    email: z.string().max(200).optional(),
  }),
  usuario: z.object({
    login: z
      .string()
      .min(3, "Login deve ter pelo menos 3 caracteres")
      .max(100)
      .regex(/^[a-zA-Z0-9._@-]+$/, "Login deve conter apenas letras, números e . _ @ -"),
    senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    email: z
      .string()
      .email("E-mail inválido")
      .max(200)
      .optional()
      .or(z.literal("")),
    telefone: z.string().max(20).optional(),
  }),
  planCode: z.string().optional(),
});

function normalizeDocument(document?: string | null) {
  return (document || "").replace(/\D/g, "");
}

// ─── Cadastro de novo tenant (rota pública) ───────────────────────────────────
setupRouter.post("/primeiro-acesso", async (req, res) => {
  const parseResult = primeiroAcessoSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: parseResult.error.issues[0]?.message ?? "Dados inválidos",
      issues: parseResult.error.issues,
    });
  }

  const { empresa: empresaData, usuario: usuarioData } = parseResult.data;

  const empresaRepo = AppDataSource.getRepository(Empresa);
  const usuarioRepo = AppDataSource.getRepository(Usuario);

  const documentClean = normalizeDocument(empresaData.cnpj);

  // ── 1. Documento já cadastrado?
  const cnpjExistente = await empresaRepo
    .createQueryBuilder("e")
    .where("regexp_replace(COALESCE(e.cnpj, ''), '\\D', '', 'g') = :doc", { doc: documentClean })
    .getOne();
  if (cnpjExistente) {
    return res.status(409).json({
      error: "Já existe uma empresa cadastrada com este CPF/CNPJ.",
      field: "cnpj",
    });
  }

  // ── 2. Login já existe?
  const loginExistente = await usuarioRepo
    .createQueryBuilder("u")
    .where("LOWER(u.login) = LOWER(:login)", { login: usuarioData.login.trim() })
    .getOne();
  if (loginExistente) {
    return res.status(409).json({
      error: "Este login já está em uso. Escolha outro nome de usuário.",
      field: "login",
    });
  }

  // ── 3. E-mail do admin já existe?
  const emailAdmin = usuarioData.email?.trim() || null;
  if (emailAdmin) {
    const emailExistente = await usuarioRepo
      .createQueryBuilder("u")
      .where("LOWER(u.email) = LOWER(:email)", { email: emailAdmin })
      .getOne();
    if (emailExistente) {
      return res.status(409).json({
        error: "Este e-mail já está vinculado a outro usuário.",
        field: "email",
      });
    }
  }

  // ── 4. Telefone + CNPJ — mesma combinação já existe?
  const telefoneAdmin = usuarioData.telefone?.trim() || null;
  if (telefoneAdmin) {
    const telefoneExistente = await usuarioRepo
      .createQueryBuilder("u")
      .innerJoin(Empresa, "e", "e.id_empresa = u.id_empresa")
      .where("u.telefone = :telefone", { telefone: telefoneAdmin })
      .andWhere("regexp_replace(COALESCE(e.cnpj, ''), '\\D', '', 'g') = :doc", { doc: documentClean })
      .getOne();
    if (telefoneExistente) {
      return res.status(409).json({
        error: "Este telefone já está cadastrado para uma conta com este CPF/CNPJ.",
        field: "telefone",
      });
    }
  }

  // ── 5. Cria a empresa
  const empresa = empresaRepo.create({ ...empresaData, ativo: true });
  const empresaSalva = await empresaRepo.save(empresa);

  // ── 6. Cria o usuário master vinculado à empresa
  const usuario = usuarioRepo.create({
    id_empresa: empresaSalva.id_empresa,
    login: usuarioData.login.trim(),
    senha: usuarioData.senha,
    email: emailAdmin,
    telefone: telefoneAdmin,
    user_master: true,
    clientes_cadastrar: true,
    clientes_alterar: true,
    clientes_excluir: true,
    loteamentos_cadastrar: true,
    loteamentos_alterar: true,
    loteamentos_excluir: true,
    vendas_cadastrar: true,
    vendas_alterar: true,
    vendas_excluir: true,
  });
  await usuarioRepo.save(usuario);

  // ── 7. Hub Billing: onboarding centralizado via /access/resolve
  // Quando o Hub está configurado e há plano selecionado, o mapeamento é obrigatório.
  let hubInfo: {
    planCode?: string;
    expiresAt?: string | null;
    trialDays?: number;
    customerId?: string | null;
    accessStatus?: string | null;
    canAccess?: boolean;
    daysLeft?: number | null;
    banner?: string | null;
  } = {};

  // ── 7b. Sem Hub: atribui plano e trial localmente
  if (!HubBillingService.isConfigured() && parseResult.data.planCode) {
    const planCode = parseResult.data.planCode.toUpperCase();
    const trialDays = getTrialDaysConfigured();
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    empresaSalva.plano = planCode;
    empresaSalva.hub_expires_at = expiresAt;
    empresaSalva.data_vencimento = expiresAt.toISOString().slice(0, 10);
    await AppDataSource.getRepository(Empresa).save(empresaSalva);

    hubInfo = {
      planCode,
      expiresAt: expiresAt.toISOString(),
      trialDays,
      canAccess: true,
      accessStatus: "trial",
      daysLeft: trialDays,
    };
  }

  if (HubBillingService.isConfigured() && parseResult.data.planCode) {
    const planCode = parseResult.data.planCode.toUpperCase();
    const hubProductId = process.env.HUB_BILLING_PRODUCT_ID || "";
    const hubTrialDays = await getTrialDaysFromHub(hubProductId);

    try {
      if (!hubProductId) {
        return res.status(500).json({
          error: "Integração Hub incompleta: HUB_BILLING_PRODUCT_ID não configurado.",
        });
      }

      const personType = documentClean.length === 11 ? "PF" : "PJ";
      const resolved = await HubBillingService.resolveAccess({
        document: documentClean,
        personType,
        productId: hubProductId,
        name: empresaData.razao_social || empresaData.nome_fantasia,
        email: usuarioData.email?.trim() || empresaData.email?.trim() || `${usuarioData.login.trim()}@local.invalid`,
      });

      const customerId = typeof resolved.customerId === "string" ? resolved.customerId : null;
      let accessStatus = typeof resolved.accessStatus === "string" ? resolved.accessStatus : null;
      let canAccess = Boolean(resolved.canAccess);
      let trialEndAt = typeof resolved.trialEndAt === "string" ? resolved.trialEndAt : null;
      let licenseEndAt = typeof resolved.licenseEndAt === "string" ? resolved.licenseEndAt : null;
      let daysLeft = typeof resolved.daysLeft === "number" ? resolved.daysLeft : null;
      const banner = typeof resolved.banner === "string" ? resolved.banner : null;
      const features =
        resolved.features && typeof resolved.features === "object" && !Array.isArray(resolved.features)
          ? (resolved.features as Record<string, unknown>)
          : null;

      if (!customerId) {
        return res.status(502).json({
          error: "Não foi possível mapear o cliente no Hub Billing durante o cadastro.",
        });
      }

      // ── Criar subscription no Hub para ativar o trial do plano selecionado
      const hubPlanMap: Record<string, { planId: string; amountCents: number }> = {
        TESTE:        { planId: process.env.HUB_BILLING_PLAN_TESTE || "",        amountCents: 100  },
        BASICO:       { planId: process.env.HUB_BILLING_PLAN_BASICO || "",       amountCents: 4990 },
        INTERMEDIARIO:{ planId: process.env.HUB_BILLING_PLAN_INTERMEDIARIO || "", amountCents: 9990 },
      };
      const selectedPlan = hubPlanMap[planCode];

      if (selectedPlan?.planId) {
        try {
          await HubBillingService.createSubscription({
            customerId,
            productId: hubProductId,
            planId: selectedPlan.planId,
            contractedAmount: selectedPlan.amountCents,
          });

          // Buscar status atualizado com datas de trial após criar a subscription
          const updatedStatus = await HubBillingService.getAccessStatus(customerId, hubProductId);
          const newTrialEndAt   = typeof updatedStatus.trialEndAt   === "string" ? updatedStatus.trialEndAt   : null;
          const newLicenseEndAt = typeof updatedStatus.licenseEndAt === "string" ? updatedStatus.licenseEndAt : null;
          const newDaysLeft     = typeof updatedStatus.daysLeft     === "number" ? updatedStatus.daysLeft     : null;
          const newAccessStatus = typeof updatedStatus.accessStatus === "string" ? updatedStatus.accessStatus : null;
          const newCanAccess    = typeof updatedStatus.canAccess    === "boolean" ? updatedStatus.canAccess   : canAccess;

          if (newTrialEndAt || newLicenseEndAt) {
            trialEndAt   = newTrialEndAt   ?? trialEndAt;
            licenseEndAt = newLicenseEndAt ?? licenseEndAt;
            daysLeft     = newDaysLeft     ?? daysLeft;
            accessStatus = newAccessStatus ?? accessStatus;
            canAccess    = newCanAccess;
            console.log(`[Setup] Subscription Hub criada para ${planCode}: expiresAt=${trialEndAt || licenseEndAt}, daysLeft=${daysLeft}`);
          }
        } catch (subErr) {
          // Non-fatal: o fallback local de trial será usado
          console.warn("[Setup] Falha ao criar subscription no Hub (non-fatal):", subErr instanceof Error ? subErr.message : subErr);
        }
      }

      const hubExpiresAt = trialEndAt || licenseEndAt || null;

      empresaSalva.hub_customer_id = customerId;
      empresaSalva.hub_product_code = hubProductId;
      empresaSalva.hub_license_status = accessStatus;
      empresaSalva.hub_license_reason = canAccess ? null : accessStatus;
      empresaSalva.hub_features = features;
      empresaSalva.plano = (typeof resolved.planCode === "string" ? resolved.planCode : planCode) || planCode;
      empresaSalva.hub_last_sync = new Date();
      empresaSalva.hub_cache_until = new Date(Date.now() + (canAccess ? 60_000 : 10_000));

      if (hubExpiresAt) {
        const parsed = new Date(hubExpiresAt);
        if (!Number.isNaN(parsed.getTime())) {
          empresaSalva.hub_expires_at = parsed;
          empresaSalva.data_vencimento = parsed.toISOString().slice(0, 10);
        }
      }

      // Fallback: Hub não retornou data de trial — definir trial localmente
      if (!empresaSalva.hub_expires_at) {
        const trialExpiresAt = new Date(Date.now() + hubTrialDays * 24 * 60 * 60 * 1000);
        empresaSalva.hub_expires_at = trialExpiresAt;
        empresaSalva.data_vencimento = trialExpiresAt.toISOString().slice(0, 10);
        if (!hubInfo.expiresAt) {
          hubInfo.expiresAt = trialExpiresAt.toISOString();
          hubInfo.daysLeft = hubTrialDays;
        }
      }

      await AppDataSource.getRepository(Empresa).save(empresaSalva);

      hubInfo = {
        planCode: empresaSalva.plano ?? planCode,
        expiresAt: empresaSalva.hub_expires_at?.toISOString() ?? hubExpiresAt,
        trialDays: hubTrialDays,
        customerId,
        accessStatus,
        canAccess,
        daysLeft: daysLeft ?? (empresaSalva.hub_expires_at
          ? Math.ceil((empresaSalva.hub_expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : hubTrialDays),
        banner,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(502).json({
        error: `Falha ao mapear cliente no Hub Billing: ${msg}`,
      });
    }
  }

  const secret = process.env.JWT_SECRET || "development-secret";
  const token = jwt.sign(
    {
      sub: usuario.id_usuario,
      login: usuario.login,
      user_master: usuario.user_master,
      id_empresa: usuario.id_empresa,
    },
    secret,
    { expiresIn: "8h" },
  );

  return res.status(201).json({
    success: true,
    message: "Empresa e usuário administrador criados com sucesso.",
    empresa: {
      id_empresa: empresaSalva.id_empresa,
      nome_fantasia: empresaSalva.nome_fantasia,
    },
    hub: Object.keys(hubInfo).length > 0 ? hubInfo : undefined,
    auth: {
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        login: usuario.login,
        user_master: usuario.user_master,
        id_empresa: usuario.id_empresa,
      },
    },
  });
});

// ─── Recuperar acesso por e-mail ou telefone (rota pública) ──────────────────
setupRouter.post("/recuperar-acesso", async (req, res) => {
  try {
    const { cnpj, email, telefone } = req.body as {
      cnpj?: string;
      email?: string;
      telefone?: string;
    };

    if (!cnpj?.trim()) {
      return res.status(400).json({ error: "CPF/CNPJ é obrigatório" });
    }
    if (!email?.trim() && !telefone?.trim()) {
      return res.status(400).json({ error: "Informe o e-mail ou telefone do administrador" });
    }

    const empresaRepo = AppDataSource.getRepository(Empresa);
    const usuarioRepo = AppDataSource.getRepository(Usuario);

    const docClean = normalizeDocument(cnpj);
    const empresa = await empresaRepo
      .createQueryBuilder("e")
      .where("regexp_replace(COALESCE(e.cnpj, ''), '\\D', '', 'g') = :doc", { doc: docClean })
      .getOne();
    if (!empresa) {
      return res.status(404).json({ error: "Nenhuma empresa encontrada com este CPF/CNPJ" });
    }

    // Busca o usuário master da empresa pelo e-mail ou telefone
    let usuario: Usuario | null = null;

    if (email?.trim()) {
      usuario = await usuarioRepo
        .createQueryBuilder("u")
        .where("u.id_empresa = :id", { id: empresa.id_empresa })
        .andWhere("LOWER(u.email) = LOWER(:email)", { email: email.trim() })
        .andWhere("u.user_master = true")
        .getOne();
    }

    if (!usuario && telefone?.trim()) {
      usuario = await usuarioRepo
        .createQueryBuilder("u")
        .where("u.id_empresa = :id", { id: empresa.id_empresa })
        .andWhere("u.telefone = :telefone", { telefone: telefone.trim() })
        .andWhere("u.user_master = true")
        .getOne();
    }

    if (!usuario) {
      return res.status(404).json({
        error: "Nenhum administrador encontrado com os dados informados",
      });
    }

    // Gera senha temporária de 8 caracteres
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let senhaTmp = "";
    for (let i = 0; i < 8; i++) {
      senhaTmp += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    usuario.senha = senhaTmp;
    await usuarioRepo.save(usuario);

    return res.json({
      success: true,
      login: usuario.login,
      senha_temporaria: senhaTmp,
    });
  } catch (error) {
    console.error("Erro ao recuperar acesso:", error);
    return res.status(500).json({ error: "Erro ao processar recuperação de acesso" });
  }
});
