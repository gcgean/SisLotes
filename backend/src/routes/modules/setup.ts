import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
import { Usuario } from "../../entities/Usuario";
import { HubBillingService } from "../../services/HubBillingService";

export const setupRouter = Router();

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

setupRouter.get("/planos-disponiveis", (_req, res) => {
  return res.json({ planos: PLANOS_DISPONIVEIS, trialDays: 14 });
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
      .refine((v) => {
        const digits = v.replace(/\D/g, "");
        return digits.length === 11 || digits.length === 14;
      }, "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido"),
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

  // ── 7. Hub Billing: onboarding centralizado via /access/resolve (opcional)
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

  if (HubBillingService.isConfigured() && parseResult.data.planCode) {
    const planCode = parseResult.data.planCode.toUpperCase();
    const hubProductId = process.env.HUB_BILLING_PRODUCT_ID || "";

    try {
      if (!hubProductId) {
        console.warn("[Hub] HUB_BILLING_PRODUCT_ID ausente. Onboarding Hub será ignorado.");
      } else {
        const personType = documentClean.length === 11 ? "PF" : "PJ";
        const resolved = await HubBillingService.resolveAccess({
          document: documentClean,
          personType,
          productId: hubProductId,
          name: empresaData.razao_social || empresaData.nome_fantasia,
          email: usuarioData.email?.trim() || empresaData.email?.trim() || `${usuarioData.login.trim()}@local.invalid`,
          phone: (usuarioData.telefone || "").replace(/\D/g, "") || undefined,
        });

        const customerId = typeof resolved.customerId === "string" ? resolved.customerId : null;
        const accessStatus = typeof resolved.accessStatus === "string" ? resolved.accessStatus : null;
        const canAccess = Boolean(resolved.canAccess);
        const trialEndAt = typeof resolved.trialEndAt === "string" ? resolved.trialEndAt : null;
        const licenseEndAt = typeof resolved.licenseEndAt === "string" ? resolved.licenseEndAt : null;
        const daysLeft = typeof resolved.daysLeft === "number" ? resolved.daysLeft : null;
        const banner = typeof resolved.banner === "string" ? resolved.banner : null;
        const features =
          resolved.features && typeof resolved.features === "object" && !Array.isArray(resolved.features)
            ? (resolved.features as Record<string, unknown>)
            : null;
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

        await AppDataSource.getRepository(Empresa).save(empresaSalva);

        hubInfo = {
          planCode: empresaSalva.plano ?? planCode,
          expiresAt: hubExpiresAt,
          trialDays: 14,
          customerId,
          accessStatus,
          canAccess,
          daysLeft,
          banner,
        };
      }
    } catch (err) {
      console.warn("[Hub] Integração ignorada durante onboarding:", err instanceof Error ? err.message : err);
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
