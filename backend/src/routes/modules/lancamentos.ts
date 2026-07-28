import { Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { LancamentoManual } from "../../entities/LancamentoManual";
import { Log } from "../../entities/Log";
import { AuthRequest, requireAuth, requireFeature } from "../../middleware/auth";

export const lancamentosRouter = Router();
lancamentosRouter.use(requireAuth, requireFeature("module_despesas"));

const lancamentoBodySchema = z.object({
  id_conta: z.number().int().positive(),
  id_loteamento: z.number().int().positive().optional().nullable(),
  tipo: z.enum(["receita", "despesa"]),
  categoria: z.string().max(100).optional().nullable(),
  descricao: z.string().min(1).max(300),
  valor: z.number().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const listQuerySchema = z.object({
  id_conta: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
  tipo: z.enum(["receita", "despesa"]).optional(),
  id_loteamento: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── GET / ────────────────────────────────────────────────────────────────────
lancamentosRouter.get("/", async (req: AuthRequest, res: Response) => {
  const parse = listQuerySchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: "Parâmetros inválidos", issues: parse.error.issues });

  const { id_conta, tipo, id_loteamento, from, to } = parse.data;

  const repo = AppDataSource.getRepository(LancamentoManual);
  const qb = repo
    .createQueryBuilder("l")
    .where("l.id_empresa = :id_empresa", { id_empresa: req.user!.id_empresa });
  if (id_conta) qb.andWhere("l.id_conta = :id_conta", { id_conta });
  if (tipo) qb.andWhere("l.tipo = :tipo", { tipo });
  if (id_loteamento) qb.andWhere("l.id_loteamento = :id_loteamento", { id_loteamento });
  if (from) qb.andWhere("l.data >= :from", { from });
  if (to) qb.andWhere("l.data <= :to", { to });
  qb.orderBy("l.data", "DESC").addOrderBy("l.id_lancamento", "DESC");

  const lancamentos = await qb.getMany();
  return res.json(lancamentos);
});

// ─── POST / ───────────────────────────────────────────────────────────────────
lancamentosRouter.post("/", async (req: AuthRequest, res: Response) => {
  const parse = lancamentoBodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const repo = AppDataSource.getRepository(LancamentoManual);
  const lancamento = repo.create({
    ...parse.data,
    valor: parse.data.valor.toFixed(2),
    id_empresa: req.user!.id_empresa,
    id_usuario: req.user!.id_usuario,
  });
  const saved = await repo.save(lancamento);

  const logRepo = AppDataSource.getRepository(Log);
  await logRepo.save(logRepo.create({
    id_usuario: req.user!.id_usuario,
    servico: "lancamento_manual_criar",
    url: "/api/lancamentos",
    log: `Lançamento manual ${saved.id_lancamento} (${saved.tipo}) criado — ${saved.descricao} — valor=${saved.valor}`,
    query: JSON.stringify(parse.data),
  }));

  return res.status(201).json(saved);
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
lancamentosRouter.put("/:id", async (req: AuthRequest, res: Response) => {
  const parse = lancamentoBodySchema.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const repo = AppDataSource.getRepository(LancamentoManual);
  const lancamento = await repo.findOne({
    where: { id_lancamento: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!lancamento) return res.status(404).json({ error: "Lançamento não encontrado" });

  const { valor, ...rest } = parse.data;
  Object.assign(lancamento, rest);
  if (valor !== undefined) lancamento.valor = valor.toFixed(2);

  const saved = await repo.save(lancamento);
  return res.json(saved);
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
lancamentosRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(LancamentoManual);
  const lancamento = await repo.findOne({
    where: { id_lancamento: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!lancamento) return res.status(404).json({ error: "Lançamento não encontrado" });

  await repo.remove(lancamento);

  const logRepo = AppDataSource.getRepository(Log);
  await logRepo.save(logRepo.create({
    id_usuario: req.user!.id_usuario,
    servico: "lancamento_manual_excluir",
    url: `/api/lancamentos/${req.params.id}`,
    log: `Lançamento manual ${req.params.id} (${lancamento.tipo}) excluído — ${lancamento.descricao} — valor=${lancamento.valor}`,
  }));

  return res.status(204).send();
});
