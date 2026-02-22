import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Loteamento } from "../../entities/Loteamento";
import { Lote } from "../../entities/Lote";
import { requireAuth, requirePermission } from "../../middleware/auth";

export const loteamentosRouter = Router();

const loteamentoBodySchema = z.object({
  nome: z.string().min(1).max(200),
  endereco: z.string().max(300).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  tipo_pessoa: z.enum(["f", "j"]).optional(),
  prop_nome: z.string().max(200).optional(),
  cnpj: z.string().max(18).optional(),
  prop_endereco: z.string().max(300).optional(),
  prop_bairro: z.string().max(100).optional(),
  prop_cidade: z.string().max(100).optional(),
  prop_estado: z.string().max(2).optional(),
  prop_cep: z.string().max(9).optional(),
  prop_fone: z.string().max(20).optional(),
});

loteamentosRouter.get("/", async (_req, res) => {
  const repo = AppDataSource.getRepository(Loteamento);

  const loteamentos = await repo.find();

  return res.json(loteamentos);
});

loteamentosRouter.get("/:id", async (req, res) => {
  const { id } = req.params;

  const loteamentoRepo = AppDataSource.getRepository(Loteamento);
  const loteRepo = AppDataSource.getRepository(Lote);

  const loteamento = await loteamentoRepo.findOne({ where: { id_loteamento: Number(id) } });

  if (!loteamento) {
    return res.status(404).json({ error: "Loteamento não encontrado" });
  }

  const totalLotes = await loteRepo.count({ where: { id_loteamento: loteamento.id_loteamento } });

  return res.json({
    ...loteamento,
    total_lotes: totalLotes,
  });
});

loteamentosRouter.get("/:id/lotes", async (req, res) => {
  const { id } = req.params;

  const loteRepo = AppDataSource.getRepository(Lote);

  const lotes = await loteRepo.find({
    where: { id_loteamento: Number(id) },
    order: { quadra: "ASC", lote: "ASC" },
  });

  return res.json(lotes);
});

loteamentosRouter.post("/", requireAuth, requirePermission("loteamentos_cadastrar"), async (req, res) => {
  const parseResult = loteamentoBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Loteamento);
  const loteamento = repo.create(parseResult.data);
  const saved = await repo.save(loteamento);

  return res.status(201).json(saved);
});

loteamentosRouter.put("/:id", requireAuth, requirePermission("loteamentos_alterar"), async (req, res) => {
  const { id } = req.params;

  const parseResult = loteamentoBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Loteamento);

  const loteamento = await repo.findOne({ where: { id_loteamento: Number(id) } });

  if (!loteamento) {
    return res.status(404).json({ error: "Loteamento não encontrado" });
  }

  Object.assign(loteamento, parseResult.data);

  const saved = await repo.save(loteamento);

  return res.json(saved);
});

loteamentosRouter.delete("/:id", requireAuth, requirePermission("loteamentos_excluir"), async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Loteamento);

  const loteamento = await repo.findOne({ where: { id_loteamento: Number(id) } });

  if (!loteamento) {
    return res.status(404).json({ error: "Loteamento não encontrado" });
  }

  await repo.remove(loteamento);

  return res.status(204).send();
});
