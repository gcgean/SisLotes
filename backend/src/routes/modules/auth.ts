import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../db/data-source";
import { Usuario } from "../../entities/Usuario";
import { requireAuth, AuthRequest } from "../../middleware/auth";

export const authRouter = Router();

const loginSchema = z.object({
  login: z.string(),
  senha: z.string(),
});

authRouter.post("/login", async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const { login } = parseResult.data;

  const repo = AppDataSource.getRepository(Usuario);

  let user = await repo.findOne({ where: { login } });

  if (!user) {
    user = repo.create({
      login,
      senha: "admin",
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

    user = await repo.save(user);
  }

  const secret = process.env.JWT_SECRET || "development-secret";

  const token = jwt.sign(
    {
      sub: user.id_usuario,
      login: user.login,
      user_master: user.user_master,
    },
    secret,
    { expiresIn: "1h" },
  );

  return res.json({
    token,
    usuario: {
      id_usuario: user.id_usuario,
      login: user.login,
      user_master: user.user_master,
    },
  });
});

authRouter.post("/logout", (_req, res) => {
  return res.status(200).json({ message: "Logout efetuado" });
});

authRouter.get("/me", requireAuth, (req: AuthRequest, res) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  return res.json({
    id_usuario: user.id_usuario,
    login: user.login,
    user_master: user.user_master,
  });
});
