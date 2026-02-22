import { Router } from "express";
import { z } from "zod";
import { ILike } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { Cliente } from "../../entities/Cliente";
import { requireAuth, requirePermission } from "../../middleware/auth";

export const clientesRouter = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  tipo: z.enum(["f", "j"]).optional(),
});

const clienteBodySchema = z.object({
  tipo: z.enum(["f", "j"]),
  nome: z.string().min(1).max(200),
  razao_social: z.string().max(200).optional(),
  cpf: z.string().max(14).optional(),
  cnpj: z.string().max(18).optional(),
  rg: z.string().max(20).optional(),
  estado_civil: z.string().max(30).optional(),
  conjuge: z.string().max(200).optional(),
  profissao: z.string().max(100).optional(),
  endereco: z.string().max(300).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().max(9).optional(),
  complemento: z.string().max(200).optional(),
  fone_res: z.string().max(20).optional(),
  fone_com: z.string().max(20).optional(),
});

clientesRouter.get("/", async (req, res) => {
  const parseResult = listQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
  }

  const { page, limit, search, tipo } = parseResult.data;

  const repo = AppDataSource.getRepository(Cliente);

  const where: Record<string, unknown> = {};

  if (tipo) {
    where.tipo = tipo;
  }

  if (search) {
    where.nome = ILike(`%${search}%`);
  }

  const [data, total] = await repo.findAndCount({
    where,
    skip: (page - 1) * limit,
    take: limit,
    order: { nome: "ASC" },
  });

  return res.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

clientesRouter.get("/:id", async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Cliente);
  const cliente = await repo.findOne({ where: { id_cliente: Number(id) } });

  if (!cliente) {
    return res.status(404).json({ error: "Cliente não encontrado" });
  }

  return res.json(cliente);
});

clientesRouter.post("/", requireAuth, requirePermission("clientes_cadastrar"), async (req, res) => {
  const parseResult = clienteBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Cliente);

  const cliente = repo.create(parseResult.data);

  const saved = await repo.save(cliente);

  return res.status(201).json(saved);
});

clientesRouter.put("/:id", requireAuth, requirePermission("clientes_alterar"), async (req, res) => {
  const { id } = req.params;

  const parseResult = clienteBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Cliente);

  const cliente = await repo.findOne({ where: { id_cliente: Number(id) } });

  if (!cliente) {
    return res.status(404).json({ error: "Cliente não encontrado" });
  }

  Object.assign(cliente, parseResult.data);

  const saved = await repo.save(cliente);

  return res.json(saved);
});

clientesRouter.delete("/:id", requireAuth, requirePermission("clientes_excluir"), async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Cliente);
  const cliente = await repo.findOne({ where: { id_cliente: Number(id) } });

  if (!cliente) {
    return res.status(404).json({ error: "Cliente não encontrado" });
  }

  await repo.remove(cliente);

  return res.status(204).send();
});

