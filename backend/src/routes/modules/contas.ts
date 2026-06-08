import { Request, Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Conta } from "../../entities/Conta";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const contasRouter = Router();

const contaBodySchema = z.object({
  apelido: z.string().min(1),
  titular: z.string().min(1),
  agencia: z.string().min(1),
  conta: z.string().min(1),
  convenio: z.string().optional(),
  ativo: z.boolean().optional(),
});

// ─── GET / — lista contas; ?ativo=true|false filtra por status ────────────────
contasRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(Conta);

  const where: Record<string, unknown> = {};
  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  // ?ativo=true → só ativas | ?ativo=false → só inativas | omitido → todas
  if (req.query.ativo !== undefined) {
    where.ativo = req.query.ativo === "true";
  }

  const contas = await repo.find({ where, order: { apelido: "ASC" } });

  return res.json(contas);
});

// ─── POST / ───────────────────────────────────────────────────────────────────
contasRouter.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const parseResult = contaBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Conta);

  const conta = repo.create({
    ...parseResult.data,
    ativo: parseResult.data.ativo ?? true,
    id_empresa: req.user?.id_empresa ?? 1,
  });

  const saved = await repo.save(conta);

  return res.status(201).json(saved);
});

// ─── PUT /:id — editar dados ──────────────────────────────────────────────────
contasRouter.put("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const parseResult = contaBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Conta);

  const where: Record<string, unknown> = { id_conta: Number(id) };
  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const conta = await repo.findOne({ where });

  if (!conta) {
    return res.status(404).json({ error: "Conta não encontrada" });
  }

  Object.assign(conta, parseResult.data);

  const saved = await repo.save(conta);

  return res.json(saved);
});

// ─── PATCH /:id/ativo — ativar / desativar ────────────────────────────────────
contasRouter.patch("/:id/ativo", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { ativo } = req.body as { ativo?: boolean };

  if (typeof ativo !== "boolean") {
    return res.status(400).json({ error: "Campo 'ativo' deve ser boolean" });
  }

  const repo = AppDataSource.getRepository(Conta);

  const where: Record<string, unknown> = { id_conta: Number(id) };
  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const conta = await repo.findOne({ where });

  if (!conta) {
    return res.status(404).json({ error: "Conta não encontrada" });
  }

  conta.ativo = ativo;
  const saved = await repo.save(conta);

  return res.json(saved);
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
contasRouter.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Conta);

  const where: Record<string, unknown> = { id_conta: Number(id) };
  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const conta = await repo.findOne({ where });

  if (!conta) {
    return res.status(404).json({ error: "Conta não encontrada" });
  }

  await repo.remove(conta);

  return res.status(204).send();
});
