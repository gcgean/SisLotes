import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Lote } from "../../entities/Lote";
import { Venda } from "../../entities/Venda";

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

lotesRouter.get("/:id", async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Lote);
  const lote = await repo.findOne({ where: { id_lote: Number(id) } });

  if (!lote) {
    return res.status(404).json({ error: "Lote não encontrado" });
  }

  return res.json(lote);
});

lotesRouter.get("/:id/status", async (req, res) => {
  const { id } = req.params;

  const vendaRepo = AppDataSource.getRepository(Venda);

  const venda = await vendaRepo.findOne({
    where: { id_lote: Number(id) },
  });

  const status = venda && venda.status !== "cancelada" ? "vendido" : "disponivel";

  return res.json({
    id_lote: Number(id),
    status,
  });
});

lotesRouter.post("/", async (req, res) => {
  const parseResult = loteBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Lote);

  const lote = repo.create(parseResult.data);

  const saved = await repo.save(lote);

  return res.status(201).json(saved);
});

lotesRouter.put("/:id", async (req, res) => {
  const { id } = req.params;

  const parseResult = loteBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Lote);

  const lote = await repo.findOne({ where: { id_lote: Number(id) } });

  if (!lote) {
    return res.status(404).json({ error: "Lote não encontrado" });
  }

  Object.assign(lote, parseResult.data);

  const saved = await repo.save(lote);

  return res.json(saved);
});

lotesRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Lote);

  const lote = await repo.findOne({ where: { id_lote: Number(id) } });

  if (!lote) {
    return res.status(404).json({ error: "Lote não encontrado" });
  }

  await repo.remove(lote);

  return res.status(204).send();
});
