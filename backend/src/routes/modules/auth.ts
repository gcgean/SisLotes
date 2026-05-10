import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../db/data-source";
import { Usuario } from "../../entities/Usuario";
import { Empresa } from "../../entities/Empresa";
import { requireAuth, AuthRequest } from "../../middleware/auth";
import { HubBillingService } from "../../services/HubBillingService";

export const authRouter = Router();

const loginSchema = z.object({
  login: z.string(),
  senha: z.string(),
});

async function resolveHubOnLoginIfNeeded(args: { empresa: Empresa; user: Usuario }) {
  const { empresa, user } = args;
  if (!HubBillingService.isConfigured()) return;
  if (empresa.hub_customer_id) return;

  const hubProductId = process.env.HUB_BILLING_PRODUCT_ID || "";
  const document = (empresa.cnpj || "").replace(/\D/g, "");
  if (!hubProductId || !document) return;

  const personType: "PF" | "PJ" = document.length === 11 ? "PF" : "PJ";
  const email = user.email?.trim() || empresa.email?.trim() || `${user.login.trim()}@local.invalid`;

  const resolved = await HubBillingService.resolveAccess({
    document,
    personType,
    productId: hubProductId,
    name: empresa.razao_social || empresa.nome_fantasia,
    email,
  });

  const quantityRaw = (resolved as Record<string, unknown>).quantity;
  const quantityParsed =
    typeof quantityRaw === "number" && Number.isFinite(quantityRaw)
      ? quantityRaw
      : typeof quantityRaw === "string" && quantityRaw.trim() && !Number.isNaN(Number(quantityRaw))
        ? Number(quantityRaw)
        : null;
  const quantity = quantityParsed != null && Number.isFinite(quantityParsed) ? quantityParsed : null;
  const planCodeRaw = (resolved as Record<string, unknown>).planCode;
  const planCode = typeof planCodeRaw === "string" ? planCodeRaw : null;
  const planNameRaw = (resolved as Record<string, unknown>).planName;
  const planName = typeof planNameRaw === "string" ? planNameRaw : null;

  empresa.hub_customer_id = typeof resolved.customerId === "string" ? resolved.customerId : empresa.hub_customer_id;
  empresa.hub_product_code = hubProductId;
  empresa.hub_license_status =
    typeof resolved.accessStatus === "string" ? resolved.accessStatus : empresa.hub_license_status;
  empresa.hub_license_reason = Boolean(resolved.canAccess)
    ? null
    : typeof resolved.reason === "string"
      ? resolved.reason
      : typeof resolved.accessStatus === "string"
        ? resolved.accessStatus
        : empresa.hub_license_reason;
  empresa.hub_last_sync = new Date();
  empresa.hub_cache_until = new Date(Date.now() + (Boolean(resolved.canAccess) ? 60_000 : 10_000));

  empresa.hub_features = HubBillingService.withHubMeta(
    (resolved.features && typeof resolved.features === "object" && !Array.isArray(resolved.features)
      ? (resolved.features as Record<string, unknown>)
      : (empresa.hub_features as Record<string, unknown> | null | undefined)) ?? {},
    {
      daysLeft: typeof resolved.daysLeft === "number" ? resolved.daysLeft : null,
      expiresAt: typeof resolved.trialEndAt === "string"
        ? resolved.trialEndAt
        : typeof resolved.licenseEndAt === "string"
          ? resolved.licenseEndAt
          : null,
      accessStatus: typeof resolved.accessStatus === "string" ? resolved.accessStatus : null,
      quantity,
      planCode,
      planName,
      syncedAt: new Date().toISOString(),
    },
  );

  const trialEndAt = typeof resolved.trialEndAt === "string" ? resolved.trialEndAt : null;
  const licenseEndAt = typeof resolved.licenseEndAt === "string" ? resolved.licenseEndAt : null;
  const expiresAtRaw = trialEndAt || licenseEndAt;
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (!Number.isNaN(parsed.getTime())) {
      empresa.hub_expires_at = parsed;
      empresa.data_vencimento = parsed.toISOString().slice(0, 10);
    }
  }
}

authRouter.post("/login", async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }

    const { login, senha } = parseResult.data;

    const usuarioRepo = AppDataSource.getRepository(Usuario);

    // Busca case-insensitive pelo login (apenas a senha é case-sensitive)
    const user = await usuarioRepo
      .createQueryBuilder("u")
      .where("LOWER(u.login) = LOWER(:login)", { login: login.trim() })
      .getOne();

    if (!user || !user.senha || user.senha !== senha) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    const empresaRepo = AppDataSource.getRepository(Empresa);

    let empresaAtiva = true;
    let empresa: Empresa | null = null;

    try {
      empresa = await empresaRepo.findOne({ where: { id_empresa: user.id_empresa } });

      if (empresa && empresa.ativo === false) {
        empresaAtiva = false;
      }
    } catch (erroVerificarEmpresa) {
      console.error("Erro ao verificar empresa ativa:", erroVerificarEmpresa);
    }

    if (!empresaAtiva) {
      return res.status(403).json({ error: "Empresa inativa. Acesso bloqueado." });
    }

    if (empresa) {
      try {
        await resolveHubOnLoginIfNeeded({ empresa, user });
        await HubBillingService.syncEmpresaLicense(empresa);
        await empresaRepo.save(empresa);
      } catch (hubError) {
        console.error("Falha ao sincronizar licença Hub Billing no login:", hubError);
      }

      if (HubBillingService.isLicenseDenied(empresa)) {
        return res.status(403).json({
          error: HubBillingService.getLicenseMessage(empresa),
          reason: empresa.hub_license_reason || empresa.hub_license_status,
        });
      }
    }

    // Atualiza ultimo_acesso da empresa (somente usuários não-master)
    if (!user.user_master) {
      try {
        await empresaRepo.update({ id_empresa: user.id_empresa }, { ultimo_acesso: new Date() });
      } catch (e) {
        // não bloqueia o login se falhar
      }
    }

    const secret = process.env.JWT_SECRET || "development-secret";

    const token = jwt.sign(
      {
        sub: user.id_usuario,
        login: user.login,
        user_master: user.user_master,
        id_empresa: user.id_empresa,
      },
      secret,
      { expiresIn: "8h" },
    );

    return res.json({
      token,
      usuario: {
        id_usuario: user.id_usuario,
        login: user.login,
        user_master: user.user_master,
        id_empresa: user.id_empresa,
      },
      licenca: empresa
        ? {
            status: empresa.hub_license_status,
            reason: empresa.hub_license_reason,
            expiresAt: empresa.hub_expires_at,
            features: empresa.hub_features ?? {},
            plano: empresa.plano,
            daysLeft: HubBillingService.getStoredDaysLeft(empresa),
          }
        : null,
    });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Erro desconhecido";

    console.error("Erro no login:", error);

    return res.status(500).json({ error: "Erro ao efetuar login", details: message });
  }
});

authRouter.post("/logout", (_req, res) => {
  return res.status(200).json({ message: "Logout efetuado" });
});

authRouter.post("/esqueci-senha", async (req, res) => {
  try {
    const { login } = req.body as { login?: string };

    if (!login || typeof login !== "string" || !login.trim()) {
      return res.status(400).json({ error: "Login é obrigatório" });
    }

    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const user = await usuarioRepo
      .createQueryBuilder("u")
      .where("LOWER(u.login) = LOWER(:login)", { login: login.trim() })
      .getOne();

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Gera senha temporária de 8 caracteres alfanuméricos
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let senhaTmp = "";
    for (let i = 0; i < 8; i++) {
      senhaTmp += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    user.senha = senhaTmp;
    await usuarioRepo.save(user);

    return res.json({ senha_temporaria: senhaTmp });
  } catch (error) {
    console.error("Erro ao recuperar senha:", error);
    return res.status(500).json({ error: "Erro ao processar recuperação de senha" });
  }
});

// ─── POST /refresh — Renova o token JWT sem precisar da senha ────────────────
authRouter.post("/refresh", requireAuth, (req: AuthRequest, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const secret = process.env.JWT_SECRET || "development-secret";

  const token = jwt.sign(
    {
      sub: user.id_usuario,
      login: user.login,
      user_master: user.user_master,
      id_empresa: user.id_empresa,
    },
    secret,
    { expiresIn: "8h" }
  );

  return res.json({ token });
});

authRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const empresa = await AppDataSource.getRepository(Empresa).findOne({
    where: { id_empresa: user.id_empresa },
  });

  return res.json({
    id_usuario: user.id_usuario,
    login: user.login,
    user_master: user.user_master,
    id_empresa: user.id_empresa,
    licenca: empresa
      ? {
          status: empresa.hub_license_status,
          reason: empresa.hub_license_reason,
          expiresAt: empresa.hub_expires_at,
          features: empresa.hub_features ?? {},
          plano: empresa.plano,
          daysLeft: HubBillingService.getStoredDaysLeft(empresa),
        }
      : null,
  });
});
