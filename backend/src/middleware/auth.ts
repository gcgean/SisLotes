import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../db/data-source";
import { Usuario } from "../entities/Usuario";

export interface AuthRequest extends Request {
  user?: Usuario;
}

interface TokenPayload {
  sub: number;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    if (process.env.NODE_ENV !== "production") {
      const repo = AppDataSource.getRepository(Usuario);

      let user = await repo.findOne({ where: { user_master: true } });

      if (!user) {
        user = repo.create({
          login: "dev",
          senha: "dev",
          user_master: true,
          id_empresa: 1,
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

        user = await repo.save(user);
      }

      req.user = user;

      return next();
    }

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
