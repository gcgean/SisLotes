import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../db/data-source";
import { Usuario } from "../../entities/Usuario";
import { Empresa } from "../../entities/Empresa";
import { requireAuth, AuthRequest } from "../../middleware/auth";

export const authRouter = Router();

const loginSchema = z.object({
  login: z.string(),
  senha: z.string(),
});

authRouter.post("/login", async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }

    const { login, senha } = parseResult.data;

    const usuarioRepo = AppDataSource.getRepository(Usuario);

    const user = await usuarioRepo.findOne({ where: { login } });

    if (!user || !user.senha || user.senha !== senha) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    const empresaRepo = AppDataSource.getRepository(Empresa);

    let empresaAtiva = true;

    try {
      const empresa = await empresaRepo.findOne({ where: { id_empresa: user.id_empresa } });

      if (empresa && empresa.ativo === false) {
        empresaAtiva = false;
      }
    } catch (erroVerificarEmpresa) {
      console.error("Erro ao verificar empresa ativa:", erroVerificarEmpresa);
    }

    if (!empresaAtiva) {
      return res.status(403).json({ error: "Empresa inativa. Acesso bloqueado." });
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
      { expiresIn: "1h" },
    );

    return res.json({
      token,
      usuario: {
        id_usuario: user.id_usuario,
        login: user.login,
        user_master: user.user_master,
        id_empresa: user.id_empresa,
      },
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

authRouter.get("/me", requireAuth, (req: AuthRequest, res) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  return res.json({
    id_usuario: user.id_usuario,
    login: user.login,
    user_master: user.user_master,
    id_empresa: user.id_empresa,
  });
});
