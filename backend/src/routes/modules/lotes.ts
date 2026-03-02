import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Lote } from "../../entities/Lote";
import { Venda } from "../../entities/Venda";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const lotesRouter = Router();

const loteBodySchema = z.object({
  id_loteamento: z.number().int().positive(),
  lote: z.string().min(1).max(20),
  quadra: z.string().min(1).max(20),
  area: z.string().max(20).optional(),
  frente: z.string().max(20).optional(),
  fundo: z.string().max(20).optional(),
  esquerdo: z.string().max(20).optional(),
  direito: z.string().max(20).optional(),
});

lotesRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const loteRepo = AppDataSource.getRepository(Lote);
  const vendaRepo = AppDataSource.getRepository(Venda);

  const whereLote: Record<string, unknown> = {};
  const whereVenda: Record<string, unknown> = {};

  if (req.user?.id_empresa) {
    whereLote.id_empresa = req.user.id_empresa;
    whereVenda.id_empresa = req.user.id_empresa;
  }

  const [lotes, vendas] = await Promise.all([
    loteRepo.find({
      where: whereLote,
      order: { quadra: "ASC", lote: "ASC" },
    }),
    vendaRepo.find({ where: whereVenda }),
  ]);

  const vendidos = new Set(
    vendas.filter((venda) => venda.status !== "cancelada").map((venda) => venda.id_lote),
  );

  const result = lotes.map((lote) => ({
    id_lote: lote.id_lote,
    id_loteamento: lote.id_loteamento,
    lote: lote.lote,
    quadra: lote.quadra,
    area: lote.area,
    frente: lote.frente,
    fundo: lote.fundo,
    esquerdo: lote.esquerdo,
    direito: lote.direito,
    status: vendidos.has(lote.id_lote) ? "vendido" : "disponivel",
  }));

  return res.json(result);
});

lotesRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Lote);

  const where: Record<string, unknown> = { id_lote: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const lote = await repo.findOne({ where });

  if (!lote) {
    return res.status(404).json({ error: "Lote não encontrado" });
  }

  return res.json(lote);
});

lotesRouter.get("/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const vendaRepo = AppDataSource.getRepository(Venda);

  const where: Record<string, unknown> = { id_lote: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const venda = await vendaRepo.findOne({
    where,
  });

  const status = venda && venda.status !== "cancelada" ? "vendido" : "disponivel";

  return res.json({
    id_lote: Number(id),
    status,
  });
});

lotesRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = loteBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Lote);

  const lote = repo.create({
    ...parseResult.data,
    id_empresa: req.user?.id_empresa ?? 1,
  });

  const saved = await repo.save(lote);

  return res.status(201).json(saved);
});

lotesRouter.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const parseResult = loteBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Lote);

  const where: Record<string, unknown> = { id_lote: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const lote = await repo.findOne({ where });

  if (!lote) {
    return res.status(404).json({ error: "Lote não encontrado" });
  }

  Object.assign(lote, parseResult.data);

  const saved = await repo.save(lote);

  return res.json(saved);
});

lotesRouter.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Lote);

  const where: Record<string, unknown> = { id_lote: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const lote = await repo.findOne({ where });

  if (!lote) {
    return res.status(404).json({ error: "Lote não encontrado" });
  }

  await repo.remove(lote);

  return res.status(204).send();
});
