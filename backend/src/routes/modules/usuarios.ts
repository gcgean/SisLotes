import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Usuario } from "../../entities/Usuario";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const usuariosRouter = Router();

const usuarioBodySchema = z.object({
  login: z.string().min(1).max(50),
  senha: z.string().min(4).max(100),
  user_master: z.boolean().optional().default(false),
  clientes_cadastrar: z.boolean().optional().default(false),
  clientes_alterar: z.boolean().optional().default(false),
  clientes_excluir: z.boolean().optional().default(false),
  loteamentos_cadastrar: z.boolean().optional().default(false),
  loteamentos_alterar: z.boolean().optional().default(false),
  loteamentos_excluir: z.boolean().optional().default(false),
  vendas_cadastrar: z.boolean().optional().default(false),
  vendas_alterar: z.boolean().optional().default(false),
  vendas_excluir: z.boolean().optional().default(false),
  id_empresa: z.number().int().positive().optional(),
});

usuariosRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!currentUser || !currentUser.user_master) {
    return res.status(403).json({ error: "Apenas usuário master pode listar usuários" });
  }

  const repo = AppDataSource.getRepository(Usuario);

  const where: Record<string, unknown> = {};
  if (currentUser.id_empresa) {
    where.id_empresa = currentUser.id_empresa;
  }

  const usuarios = await repo.find({ where, order: { login: "ASC" } });

  return res.json(usuarios);
});

usuariosRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!currentUser || !currentUser.user_master) {
    return res.status(403).json({ error: "Apenas usuário master pode criar usuários" });
  }

  const parseResult = usuarioBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Usuario);

  const existing = await repo.findOne({ where: { login: parseResult.data.login } });

  if (existing) {
    return res.status(400).json({ error: "Login já em uso" });
  }

  const data = parseResult.data;

  const usuario = repo.create({
    ...data,
    id_empresa: data.id_empresa ?? currentUser.id_empresa,
  });
  const saved = await repo.save(usuario);

  return res.status(201).json(saved);
});

usuariosRouter.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!currentUser || !currentUser.user_master) {
    return res.status(403).json({ error: "Apenas usuário master pode alterar usuários" });
  }

  const { id } = req.params;

  const parseResult = usuarioBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Usuario);

  const where: Record<string, unknown> = { id_usuario: Number(id) };
  if (currentUser.id_empresa) {
    where.id_empresa = currentUser.id_empresa;
  }

  const usuario = await repo.findOne({ where });

  if (!usuario) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  if (usuario.id_usuario === currentUser.id_usuario && parseResult.data.user_master === false) {
    return res.status(400).json({ error: "Não é possível remover seu próprio acesso master" });
  }

  Object.assign(usuario, parseResult.data);

  const saved = await repo.save(usuario);

  return res.json(saved);
});

usuariosRouter.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!currentUser || !currentUser.user_master) {
    return res.status(403).json({ error: "Apenas usuário master pode excluir usuários" });
  }

  const { id } = req.params;

  const repo = AppDataSource.getRepository(Usuario);

  const where: Record<string, unknown> = { id_usuario: Number(id) };
  if (currentUser.id_empresa) {
    where.id_empresa = currentUser.id_empresa;
  }

  const usuario = await repo.findOne({ where });

  if (!usuario) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  if (usuario.id_usuario === currentUser.id_usuario) {
    return res.status(400).json({ error: "Não é possível excluir o próprio usuário" });
  }

  await repo.remove(usuario);

  return res.status(204).send();
});
