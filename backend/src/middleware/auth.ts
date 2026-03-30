import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../db/data-source";
import { Usuario } from "../entities/Usuario";
import { Empresa } from "../entities/Empresa";
import { HubBillingService } from "../services/HubBillingService";
import { isFeatureEnabledForPlan } from "../config/license-features";

export interface AuthRequest extends Request {
  user?: Usuario;
}

interface TokenPayload {
  sub: number;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const token = header.slice(7);

  try {
    const secret = process.env.JWT_SECRET || "development-secret";
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;

    const sub = decoded.sub ? Number(decoded.sub) : undefined;

    if (!sub) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const repo = AppDataSource.getRepository(Usuario);
    const user = await repo.findOne({ where: { id_usuario: sub } });

    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }

    if (user.login.toLowerCase() !== "gcgean") {
      const empresaRepo = AppDataSource.getRepository(Empresa);
      const empresa = await empresaRepo.findOne({ where: { id_empresa: user.id_empresa } });

      if (!empresa || !empresa.ativo) {
        return res.status(403).json({ error: "Empresa inativa. Acesso bloqueado." });
      }

      if (HubBillingService.isConfigured() && empresa.hub_customer_id) {
        try {
          await HubBillingService.syncEmpresaLicense(empresa);
        } catch (hubError) {
          console.warn("Falha ao sincronizar licença no middleware auth:", hubError);
        }
      }

      if (HubBillingService.isLicenseDenied(empresa)) {
        return res.status(403).json({
          error: HubBillingService.getLicenseMessage(empresa),
          reason: empresa.hub_license_reason || empresa.hub_license_status,
        });
      }
    }

    req.user = user;

    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

type PermissionKey =
  | "clientes_cadastrar"
  | "clientes_alterar"
  | "clientes_excluir"
  | "loteamentos_cadastrar"
  | "loteamentos_alterar"
  | "loteamentos_excluir"
  | "vendas_cadastrar"
  | "vendas_alterar"
  | "vendas_excluir";

export function requireMaster(req: AuthRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Não autenticado" });
  if (user.login.toLowerCase() !== "gcgean") {
    return res.status(403).json({ error: "Acesso restrito ao administrador da plataforma" });
  }
  return next();
}

export function requirePermission(permission: PermissionKey) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    if (user.user_master) {
      return next();
    }

    if (user[permission]) {
      return next();
    }

    return res.status(403).json({ error: "Permissão negada" });
  };
}

export function requireFeature(feature: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    if (user.login.toLowerCase() === "gcgean") {
      return next();
    }
    const empresa = await AppDataSource.getRepository(Empresa).findOne({
      where: { id_empresa: user.id_empresa },
    });
    if (!empresa) {
      return res.status(403).json({ error: "Empresa não encontrada" });
    }
    const configured = Boolean(process.env.HUB_BILLING_BASE_URL && process.env.HUB_BILLING_API_KEY);
    if (!configured) {
      return next();
    }
    if (!isFeatureEnabledForPlan({
      plan: empresa.plano,
      rawFeatures: empresa.hub_features ?? {},
      feature,
    })) {
      return res.status(403).json({
        error: "Recurso indisponível no plano atual",
        feature,
      });
    }
    return next();
  };
}
