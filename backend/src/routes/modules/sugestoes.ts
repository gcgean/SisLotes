import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Sugestao, SugestaoStatus } from "../../entities/Sugestao";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const sugestoesRouter = Router();

function isAdmin(req: AuthRequest) {
  const login = req.user?.login?.toLowerCase();
  return !!req.user?.user_master || login === "gcgean";
}

const createSugestaoSchema = z.object({
  titulo: z.string().min(3, "Título é obrigatório").max(200),
  descricao: z.string().min(10, "Descrição é obrigatória"),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  status: z.enum(["aberta", "em_analise", "concluida"]).optional(),
  search: z.string().optional(),
  id_empresa: z.coerce.number().int().positive().optional(),
});

const updateSugestaoSchema = z.object({
  status: z.enum(["aberta", "em_analise", "concluida"]).optional(),
  resposta_admin: z.string().max(5000).optional().nullable(),
});

sugestoesRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = createSugestaoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parsed.error.issues });
  }

  const repo = AppDataSource.getRepository(Sugestao);

  const sugestao = repo.create({
    id_empresa: req.user!.id_empresa,
    id_usuario: req.user!.id_usuario,
    titulo: parsed.data.titulo.trim(),
    descricao: parsed.data.descricao.trim(),
    status: "aberta",
    resposta_admin: null,
  });

  const saved = await repo.save(sugestao);

  return res.status(201).json({
    id_sugestao: saved.id_sugestao,
    titulo: saved.titulo,
    descricao: saved.descricao,
    status: saved.status,
    resposta_admin: saved.resposta_admin,
    created_at: saved.created_at,
    updated_at: saved.updated_at,
  });
});

sugestoesRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Sem permissão" });
  }

  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos", issues: parsed.error.issues });
  }

  const { page, limit, status, search, id_empresa } = parsed.data;

  const repo = AppDataSource.getRepository(Sugestao);
  const qb = repo.createQueryBuilder("s").leftJoinAndSelect("s.usuario", "usuario");

  const isPlatformAdmin = req.user?.login?.toLowerCase() === "gcgean";
  if (isPlatformAdmin) {
    if (id_empresa) {
      qb.where("s.id_empresa = :id_empresa", { id_empresa });
    }
  } else if (req.user?.id_empresa) {
    qb.where("s.id_empresa = :id_empresa", { id_empresa: req.user.id_empresa });
  }

  if (status) {
    qb.andWhere("s.status = :status", { status });
  }

  if (search) {
    qb.andWhere("(s.titulo ILIKE :search OR s.descricao ILIKE :search)", { search: `%${search}%` });
  }

  const [data, total] = await qb
    .orderBy("s.created_at", "DESC")
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return res.json({
    data: data.map((s) => ({
      id_sugestao: s.id_sugestao,
      id_empresa: s.id_empresa,
      titulo: s.titulo,
      descricao: s.descricao,
      status: s.status,
      resposta_admin: s.resposta_admin,
      created_at: s.created_at,
      updated_at: s.updated_at,
      usuario: s.usuario ? { id_usuario: s.usuario.id_usuario, login: s.usuario.login } : null,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

sugestoesRouter.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Sem permissão" });
  }

  const { id } = req.params;
  const parsed = updateSugestaoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parsed.error.issues });
  }

  const repo = AppDataSource.getRepository(Sugestao);

  const where: Record<string, unknown> = { id_sugestao: Number(id) };

  const isPlatformAdmin = req.user?.login?.toLowerCase() === "gcgean";
  if (!isPlatformAdmin && req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const sugestao = await repo.findOne({ where, relations: ["usuario"] });
  if (!sugestao) {
    return res.status(404).json({ error: "Sugestão não encontrada" });
  }

  if (typeof parsed.data.status !== "undefined") {
    sugestao.status = parsed.data.status as SugestaoStatus;
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "resposta_admin")) {
    const v = parsed.data.resposta_admin;
    sugestao.resposta_admin = v && v.trim() !== "" ? v : null;
  }

  const saved = await repo.save(sugestao);

  return res.json({
    id_sugestao: saved.id_sugestao,
    id_empresa: saved.id_empresa,
    titulo: saved.titulo,
    descricao: saved.descricao,
    status: saved.status,
    resposta_admin: saved.resposta_admin,
    created_at: saved.created_at,
    updated_at: saved.updated_at,
    usuario: saved.usuario ? { id_usuario: saved.usuario.id_usuario, login: saved.usuario.login } : null,
  });
});
