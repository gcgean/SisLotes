import { Router } from "express";
import { z } from "zod";
import { ILike } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { Cliente } from "../../entities/Cliente";
import { AuthRequest, requireAuth, requirePermission } from "../../middleware/auth";

export const clientesRouter = Router();

// ─── CPF/CNPJ validation helpers ─────────────────────────────────────────────
function allDigitsEqual(d: string) { return /^(\d)\1+$/.test(d); }

function isValidCpf(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || allDigitsEqual(d)) return false;
  const n = d.split("").map(Number);
  let s = 0; for (let i = 0; i < 9; i++) s += n[i] * (10 - i);
  let mod = s % 11; const d1 = mod < 2 ? 0 : 11 - mod;
  if (n[9] !== d1) return false;
  s = 0; for (let i = 0; i < 10; i++) s += n[i] * (11 - i);
  mod = s % 11; const d2 = mod < 2 ? 0 : 11 - mod;
  return n[10] === d2;
}

function isValidCnpj(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14 || allDigitsEqual(d)) return false;
  const n = d.split("").map(Number);
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let s = 0; for (let i = 0; i < 12; i++) s += n[i] * w1[i];
  let mod = s % 11; const d1 = mod < 2 ? 0 : 11 - mod;
  if (n[12] !== d1) return false;
  s = 0; for (let i = 0; i < 13; i++) s += n[i] * w2[i];
  mod = s % 11; const d2 = mod < 2 ? 0 : 11 - mod;
  return n[13] === d2;
}
// ─────────────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  search: z.string().optional(),
  tipo: z.enum(["f", "j"]).optional(),
});

// Base object schema — can call .partial() on it
const clienteBaseSchema = z.object({
  tipo: z.enum(["f", "j"]),
  nome: z.string().min(1, "Nome é obrigatório").max(200),
  razao_social: z.string().max(200).optional(),
  cpf: z.string().max(14).optional().refine(
    (v) => !v || v.trim() === "" || isValidCpf(v),
    { message: "CPF inválido" }
  ),
  cnpj: z.string().max(18).optional().refine(
    (v) => !v || v.trim() === "" || isValidCnpj(v),
    { message: "CNPJ inválido" }
  ),
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

// For CREATE: add cross-field validation (CPF required for PF, CNPJ for PJ)
const clienteBodySchema = clienteBaseSchema.superRefine((data, ctx) => {
  if (data.tipo === "f" && !data.cpf?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CPF é obrigatório para pessoa física", path: ["cpf"] });
  }
  if (data.tipo === "j" && !data.cnpj?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CNPJ é obrigatório para pessoa jurídica", path: ["cnpj"] });
  }
});

// For UPDATE: partial — tipo/nome/cpf/cnpj all optional
const clienteUpdateSchema = clienteBaseSchema.partial();

clientesRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = listQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
  }

  const { page, limit, search, tipo } = parseResult.data;

  const repo = AppDataSource.getRepository(Cliente);

  const where: Record<string, unknown> = {};

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

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

clientesRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Cliente);

  const where: Record<string, unknown> = { id_cliente: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const cliente = await repo.findOne({ where });

  if (!cliente) {
    return res.status(404).json({ error: "Cliente não encontrado" });
  }

  return res.json(cliente);
});

clientesRouter.post("/", requireAuth, requirePermission("clientes_cadastrar"), async (req: AuthRequest, res) => {
  const parseResult = clienteBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Cliente);

  const data = parseResult.data;

  const cliente = repo.create({
    ...data,
    cpf: data.cpf && data.cpf.trim() !== "" ? data.cpf : null,
    cnpj: data.cnpj && data.cnpj.trim() !== "" ? data.cnpj : null,
    id_empresa: req.user?.id_empresa ?? 1,
  });

  try {
    const saved = await repo.save(cliente);
    return res.status(201).json(saved);
  } catch (error) {
    if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
      const message = (error as { message: string }).message;

      if (message.includes("idx_clientes_cpf") || message.includes("clientes_cpf")) {
        return res.status(400).json({ error: "CPF já cadastrado" });
      }

      if (message.includes("idx_clientes_cnpj") || message.includes("clientes_cnpj")) {
        return res.status(400).json({ error: "CNPJ já cadastrado" });
      }
    }

    console.error("Erro ao salvar cliente (POST):", error);
    return res.status(500).json({ error: "Erro ao salvar cliente" });
  }
});

clientesRouter.put("/:id", requireAuth, requirePermission("clientes_alterar"), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const parseResult = clienteUpdateSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Cliente);

  const where: Record<string, unknown> = { id_cliente: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const cliente = await repo.findOne({ where });

  if (!cliente) {
    return res.status(404).json({ error: "Cliente não encontrado" });
  }

  const data = parseResult.data;

  Object.assign(cliente, data);

  if ("cpf" in data) {
    cliente.cpf = data.cpf && data.cpf.trim() !== "" ? data.cpf : null;
  }

  if ("cnpj" in data) {
    cliente.cnpj = data.cnpj && data.cnpj.trim() !== "" ? data.cnpj : null;
  }

  try {
    const saved = await repo.save(cliente);
    return res.json(saved);
  } catch (error) {
    if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
      const message = (error as { message: string }).message;

      if (message.includes("idx_clientes_cpf") || message.includes("clientes_cpf")) {
        return res.status(400).json({ error: "CPF já cadastrado" });
      }

      if (message.includes("idx_clientes_cnpj") || message.includes("clientes_cnpj")) {
        return res.status(400).json({ error: "CNPJ já cadastrado" });
      }
    }

    console.error("Erro ao salvar cliente (PUT):", error);
    return res.status(500).json({ error: "Erro ao salvar cliente" });
  }
});

clientesRouter.delete("/:id", requireAuth, requirePermission("clientes_excluir"), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Cliente);

  const where: Record<string, unknown> = { id_cliente: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const cliente = await repo.findOne({ where });

  if (!cliente) {
    return res.status(404).json({ error: "Cliente não encontrado" });
  }

  await repo.remove(cliente);

  return res.status(204).send();
});
