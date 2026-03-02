import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const empresasRouter = Router();

const empresaBodySchema = z.object({
  nome_fantasia: z.string().min(1).max(200),
  razao_social: z.string().max(200).optional(),
  cnpj: z.string().max(18).optional(),
  ie: z.string().max(20).optional(),
  endereco: z.string().max(300).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().max(9).optional(),
  telefone: z.string().max(20).optional(),
  ativo: z.boolean().optional(),
});

empresasRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!currentUser || !currentUser.user_master) {
    return res.status(403).json({ error: "Apenas usuário master pode listar empresas" });
  }

  const repo = AppDataSource.getRepository(Empresa);
  const empresas = await repo.find({ order: { nome_fantasia: "ASC" } });

  return res.json(empresas);
});

empresasRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!currentUser || !currentUser.user_master) {
    return res.status(403).json({ error: "Apenas usuário master pode criar empresas" });
  }

  const parseResult = empresaBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Empresa);

  const empresa = repo.create({
    ...parseResult.data,
    ativo: true,
  });
  const saved = await repo.save(empresa);

  return res.status(201).json(saved);
});

empresasRouter.put("/:id/ativo", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!currentUser || !currentUser.user_master) {
    return res.status(403).json({ error: "Apenas usuário master pode alterar empresas" });
  }

  const { id } = req.params;

  const parseResult = z
    .object({
      ativo: z.boolean(),
    })
    .safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Empresa);

  const empresa = await repo.findOne({ where: { id_empresa: Number(id) } });

  if (!empresa) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  empresa.ativo = parseResult.data.ativo;

  const saved = await repo.save(empresa);

  return res.json(saved);
});
