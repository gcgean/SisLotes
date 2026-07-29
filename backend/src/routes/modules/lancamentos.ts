import { Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { LancamentoManual } from "../../entities/LancamentoManual";
import { LancamentoRateio } from "../../entities/LancamentoRateio";
import { Log } from "../../entities/Log";
import { AuthRequest, requireAuth, requireFeature } from "../../middleware/auth";

export const lancamentosRouter = Router();
lancamentosRouter.use(requireAuth, requireFeature("module_despesas"));

const lancamentoRateioItemSchema = z.object({
  id_loteamento: z.number().int().positive(),
  percentual: z.number().positive().max(100),
});

const lancamentoBodyObjectSchema = z.object({
  id_conta: z.number().int().positive(),
  id_loteamento: z.number().int().positive().optional().nullable(),
  tipo: z.enum(["receita", "despesa"]),
  id_conta_contabil: z.number().int().positive().optional().nullable(),
  id_fornecedor: z.number().int().positive().optional().nullable(),
  descricao: z.string().min(1).max(300),
  valor: z.number().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Rateio entre loteamentos (ex: despesa que atende mais de um empreendimento).
  // Quando informado, "id_loteamento" deve ficar vazio e a soma dos percentuais = 100.
  rateio: z.array(lancamentoRateioItemSchema).optional(),
});

const lancamentoBodySchema = lancamentoBodyObjectSchema
  .refine((d) => !d.rateio || d.rateio.length === 0 || d.id_loteamento == null, {
    message: 'Ao ratear entre loteamentos, deixe o campo "Loteamento" em branco.',
    path: ["id_loteamento"],
  })
  .refine(
    (d) => {
      if (!d.rateio || d.rateio.length === 0) return true;
      const soma = d.rateio.reduce((s, r) => s + r.percentual, 0);
      return Math.abs(soma - 100) < 0.5;
    },
    { message: "A soma dos percentuais do rateio deve ser 100%.", path: ["rateio"] },
  );

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

  const rateioRows = (await AppDataSource.query(
    `SELECT r.id_lancamento, r.id_loteamento, r.percentual, lo.nome AS loteamento_nome
     FROM lancamento_rateio r
     JOIN loteamentos lo ON lo.id_loteamento = r.id_loteamento
     WHERE r.id_empresa = $1`,
    [req.user!.id_empresa]
  )) as Array<{ id_lancamento: number; id_loteamento: number; percentual: string; loteamento_nome: string }>;

  const rateioPorLancamento = new Map<number, typeof rateioRows>();
  for (const r of rateioRows) {
    const lista = rateioPorLancamento.get(r.id_lancamento) ?? [];
    lista.push(r);
    rateioPorLancamento.set(r.id_lancamento, lista);
  }

  const resultado = lancamentos.map((l) => ({ ...l, rateio: rateioPorLancamento.get(l.id_lancamento) ?? [] }));
  return res.json(resultado);
});

// ─── POST / ───────────────────────────────────────────────────────────────────
lancamentosRouter.post("/", async (req: AuthRequest, res: Response) => {
  const parse = lancamentoBodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const { rateio, ...data } = parse.data;
  const idEmpresa = req.user!.id_empresa;

  const repo = AppDataSource.getRepository(LancamentoManual);
  const lancamento = repo.create({
    ...data,
    valor: data.valor.toFixed(2),
    id_empresa: idEmpresa,
    id_usuario: req.user!.id_usuario,
  });
  const saved = await repo.save(lancamento);

  if (rateio && rateio.length > 0) {
    const rateioRepo = AppDataSource.getRepository(LancamentoRateio);
    await rateioRepo.save(
      rateio.map((r) =>
        rateioRepo.create({
          id_empresa: idEmpresa,
          id_lancamento: saved.id_lancamento,
          id_loteamento: r.id_loteamento,
          percentual: r.percentual.toFixed(2),
        })
      )
    );
  }

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
  const parse = lancamentoBodyObjectSchema.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const repo = AppDataSource.getRepository(LancamentoManual);
  const lancamento = await repo.findOne({
    where: { id_lancamento: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!lancamento) return res.status(404).json({ error: "Lançamento não encontrado" });

  const { valor, rateio, ...rest } = parse.data;

  if (rateio && rateio.length > 0) {
    const soma = rateio.reduce((s, r) => s + r.percentual, 0);
    if (Math.abs(soma - 100) >= 0.5) {
      return res.status(400).json({ error: "A soma dos percentuais do rateio deve ser 100%." });
    }
    if (rest.id_loteamento != null) {
      return res.status(400).json({ error: 'Ao ratear entre loteamentos, deixe o campo "Loteamento" em branco.' });
    }
    rest.id_loteamento = null;
  }

  Object.assign(lancamento, rest);
  if (valor !== undefined) lancamento.valor = valor.toFixed(2);

  const saved = await repo.save(lancamento);

  if (rateio !== undefined) {
    const rateioRepo = AppDataSource.getRepository(LancamentoRateio);
    await rateioRepo.delete({ id_lancamento: lancamento.id_lancamento });
    if (rateio.length > 0) {
      await rateioRepo.save(
        rateio.map((r) =>
          rateioRepo.create({
            id_empresa: req.user!.id_empresa,
            id_lancamento: lancamento.id_lancamento,
            id_loteamento: r.id_loteamento,
            percentual: r.percentual.toFixed(2),
          })
        )
      );
    }
  }

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
