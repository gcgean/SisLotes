import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Loteamento } from "../../entities/Loteamento";
import { Lote } from "../../entities/Lote";
import { AuthRequest, requireAuth, requirePermission } from "../../middleware/auth";

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

loteamentosRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const repo = AppDataSource.getRepository(Loteamento);

  const where: Record<string, unknown> = {};

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const loteamentos = await repo.find({
    where,
    order: { nome: "ASC" },
  });

  return res.json(loteamentos);
});

loteamentosRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const loteamentoRepo = AppDataSource.getRepository(Loteamento);
  const loteRepo = AppDataSource.getRepository(Lote);

  const whereLoteamento: Record<string, unknown> = { id_loteamento: Number(id) };

  if (req.user?.id_empresa) {
    whereLoteamento.id_empresa = req.user.id_empresa;
  }

  const loteamento = await loteamentoRepo.findOne({ where: whereLoteamento });

  if (!loteamento) {
    return res.status(404).json({ error: "Loteamento não encontrado" });
  }

  const whereLote: Record<string, unknown> = { id_loteamento: loteamento.id_loteamento };

  if (req.user?.id_empresa) {
    whereLote.id_empresa = req.user.id_empresa;
  }

  const totalLotes = await loteRepo.count({ where: whereLote });

  return res.json({
    ...loteamento,
    total_lotes: totalLotes,
  });
});

loteamentosRouter.get("/:id/lotes", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const loteRepo = AppDataSource.getRepository(Lote);

  const where: Record<string, unknown> = { id_loteamento: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const lotes = await loteRepo.find({
    where,
    order: { quadra: "ASC", lote: "ASC" },
  });

  return res.json(lotes);
});

loteamentosRouter.post("/", requireAuth, requirePermission("loteamentos_cadastrar"), async (req: AuthRequest, res) => {
  const parseResult = loteamentoBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Loteamento);
  const loteamento = repo.create({
    ...parseResult.data,
    id_empresa: req.user?.id_empresa ?? 1,
  });
  const saved = await repo.save(loteamento);

  return res.status(201).json(saved);
});

loteamentosRouter.put("/:id", requireAuth, requirePermission("loteamentos_alterar"), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const parseResult = loteamentoBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Loteamento);

  const where: Record<string, unknown> = { id_loteamento: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const loteamento = await repo.findOne({ where });

  if (!loteamento) {
    return res.status(404).json({ error: "Loteamento não encontrado" });
  }

  Object.assign(loteamento, parseResult.data);

  const saved = await repo.save(loteamento);

  return res.json(saved);
});

loteamentosRouter.delete("/:id", requireAuth, requirePermission("loteamentos_excluir"), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Loteamento);

  const where: Record<string, unknown> = { id_loteamento: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const loteamento = await repo.findOne({ where });

  if (!loteamento) {
    return res.status(404).json({ error: "Loteamento não encontrado" });
  }

  await repo.remove(loteamento);

  return res.status(204).send();
});
