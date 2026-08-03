import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Sugestao, SugestaoStatus } from "../../entities/Sugestao";
import { SugestaoMensagem } from "../../entities/SugestaoMensagem";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const sugestoesRouter = Router();

function isAdmin(req: AuthRequest) {
  const login = req.user?.login?.toLowerCase();
  return !!req.user?.user_master || login === "gcgean";
}

function isPlatformAdmin(req: AuthRequest) {
  return req.user?.login?.toLowerCase() === "gcgean";
}

const anexoSchema = z.object({
  anexo_nome: z.string().max(200).optional().nullable(),
  anexo_base64: z.string().max(8_000_000, "Arquivo muito grande").optional().nullable(),
});

const createSugestaoSchema = z
  .object({
    titulo: z.string().min(3, "Título é obrigatório").max(200),
    descricao: z.string().min(10, "Descrição é obrigatória"),
  })
  .merge(anexoSchema);

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

const mensagemSchema = z
  .object({
    mensagem: z.string().max(5000).optional(),
  })
  .merge(anexoSchema)
  .refine((d) => (d.mensagem && d.mensagem.trim() !== "") || d.anexo_base64, {
    message: "Escreva uma mensagem ou anexe um arquivo",
  });

function serializeSugestao(s: Sugestao) {
  return {
    id_sugestao: s.id_sugestao,
    id_empresa: s.id_empresa,
    titulo: s.titulo,
    descricao: s.descricao,
    status: s.status,
    resposta_admin: s.resposta_admin,
    anexo_nome: s.anexo_nome,
    anexo_base64: s.anexo_base64,
    created_at: s.created_at,
    updated_at: s.updated_at,
    usuario: s.usuario ? { id_usuario: s.usuario.id_usuario, login: s.usuario.login } : null,
  };
}

function serializeMensagem(m: SugestaoMensagem) {
  return {
    id_mensagem: m.id_mensagem,
    id_sugestao: m.id_sugestao,
    autor_admin: m.autor_admin,
    mensagem: m.mensagem,
    anexo_nome: m.anexo_nome,
    anexo_base64: m.anexo_base64,
    created_at: m.created_at,
    usuario: m.usuario ? { id_usuario: m.usuario.id_usuario, login: m.usuario.login } : null,
  };
}

// ─── POST / — cria uma nova sugestão (usuário pode enviar quantas quiser) ────
sugestoesRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = createSugestaoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos", issues: parsed.error.issues });
  }

  const repo = AppDataSource.getRepository(Sugestao);

  const sugestao = repo.create({
    id_empresa: req.user!.id_empresa,
    id_usuario: req.user!.id_usuario,
    titulo: parsed.data.titulo.trim(),
    descricao: parsed.data.descricao.trim(),
    status: "aberta",
    resposta_admin: null,
    anexo_nome: parsed.data.anexo_nome ?? null,
    anexo_base64: parsed.data.anexo_base64 ?? null,
  });

  const saved = await repo.save(sugestao);

  return res.status(201).json(serializeSugestao(saved));
});

// ─── GET /minhas — sugestões enviadas pela própria empresa (acompanhar status) ─
sugestoesRouter.get("/minhas", requireAuth, async (req: AuthRequest, res) => {
  const repo = AppDataSource.getRepository(Sugestao);
  const sugestoes = await repo.find({
    where: { id_empresa: req.user!.id_empresa },
    relations: ["usuario"],
    order: { created_at: "DESC" },
  });

  // Conta mensagens de cada sugestão para indicar quantas respostas já chegaram.
  const ids = sugestoes.map((s) => s.id_sugestao);
  let contagem: Record<number, number> = {};
  if (ids.length > 0) {
    const rows = await AppDataSource.getRepository(SugestaoMensagem)
      .createQueryBuilder("m")
      .select("m.id_sugestao", "id_sugestao")
      .addSelect("COUNT(*)", "total")
      .where("m.id_sugestao IN (:...ids)", { ids })
      .groupBy("m.id_sugestao")
      .getRawMany<{ id_sugestao: number; total: string }>();
    contagem = Object.fromEntries(rows.map((r) => [r.id_sugestao, Number(r.total)]));
  }

  return res.json(
    sugestoes.map((s) => ({ ...serializeSugestao(s), total_mensagens: contagem[s.id_sugestao] ?? 0 }))
  );
});

// ─── GET / — lista todas as sugestões (apenas gestor da plataforma) ───────────
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

  if (isPlatformAdmin(req)) {
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
    data: data.map(serializeSugestao),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

async function findSugestaoComAcesso(req: AuthRequest, id: number): Promise<Sugestao | null> {
  const repo = AppDataSource.getRepository(Sugestao);
  const where: Record<string, unknown> = { id_sugestao: id };
  if (!isPlatformAdmin(req)) {
    where.id_empresa = req.user!.id_empresa;
  }
  return repo.findOne({ where, relations: ["usuario"] });
}

// ─── GET /:id — detalhe da sugestão + thread de mensagens (chat) ─────────────
sugestoesRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const sugestao = await findSugestaoComAcesso(req, Number(req.params.id));
  if (!sugestao) return res.status(404).json({ error: "Sugestão não encontrada" });

  const mensagens = await AppDataSource.getRepository(SugestaoMensagem).find({
    where: { id_sugestao: sugestao.id_sugestao },
    relations: ["usuario"],
    order: { created_at: "ASC" },
  });

  return res.json({ ...serializeSugestao(sugestao), mensagens: mensagens.map(serializeMensagem) });
});

// ─── POST /:id/mensagens — envia uma mensagem no chat (usuário ou gestor) ────
sugestoesRouter.post("/:id/mensagens", requireAuth, async (req: AuthRequest, res) => {
  const parsed = mensagemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos", issues: parsed.error.issues });
  }

  const sugestao = await findSugestaoComAcesso(req, Number(req.params.id));
  if (!sugestao) return res.status(404).json({ error: "Sugestão não encontrada" });

  const repo = AppDataSource.getRepository(SugestaoMensagem);
  const mensagem = repo.create({
    id_sugestao: sugestao.id_sugestao,
    id_usuario: req.user!.id_usuario,
    autor_admin: isAdmin(req),
    mensagem: parsed.data.mensagem?.trim() || null,
    anexo_nome: parsed.data.anexo_nome ?? null,
    anexo_base64: parsed.data.anexo_base64 ?? null,
  });
  const saved = await repo.save(mensagem);
  saved.usuario = req.user!;

  // Uma nova mensagem do gestor move para "em análise" se ainda estava aberta;
  // uma nova mensagem do usuário reabre uma sugestão que já tinha sido concluída.
  const sugestaoRepo = AppDataSource.getRepository(Sugestao);
  if (isAdmin(req) && sugestao.status === "aberta") {
    sugestao.status = "em_analise";
    await sugestaoRepo.save(sugestao);
  } else if (!isAdmin(req) && sugestao.status === "concluida") {
    sugestao.status = "em_analise";
    await sugestaoRepo.save(sugestao);
  }

  return res.status(201).json(serializeMensagem(saved));
});

// ─── PATCH /:id — gestor atualiza o status da sugestão ───────────────────────
sugestoesRouter.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Sem permissão" });
  }

  const parsed = updateSugestaoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parsed.error.issues });
  }

  const sugestao = await findSugestaoComAcesso(req, Number(req.params.id));
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

  const saved = await AppDataSource.getRepository(Sugestao).save(sugestao);

  return res.json(serializeSugestao(saved));
});
