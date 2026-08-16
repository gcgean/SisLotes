import { Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { LancamentoManual } from "../../entities/LancamentoManual";
import { LancamentoRateio } from "../../entities/LancamentoRateio";
import { Conta } from "../../entities/Conta";
import { TransferenciaConta } from "../../entities/TransferenciaConta";
import { Log } from "../../entities/Log";
import { AuthRequest, requireAuth, requireFeature } from "../../middleware/auth";
import { AuditoriaService } from "../../services/AuditoriaService";
import { contaContabilAceitaLancamento } from "../../utils/plano-contas";
import { verificarPeriodoFinanceiro } from "../../services/PeriodoFinanceiroService";

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

const transferenciaBodySchema = z.object({
  id_conta_origem: z.number().int().positive(),
  id_conta_destino: z.number().int().positive(),
  descricao: z.string().trim().min(1).max(300),
  valor: z.number().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((data) => data.id_conta_origem !== data.id_conta_destino, {
  message: "As contas de origem e destino devem ser diferentes.",
  path: ["id_conta_destino"],
});

async function validarContasTransferencia(idEmpresa: number, ids: number[]): Promise<boolean> {
  const contas = await AppDataSource.getRepository(Conta)
    .createQueryBuilder("conta")
    .where("conta.id_empresa = :idEmpresa", { idEmpresa })
    .andWhere("conta.id_conta IN (:...ids)", { ids })
    .andWhere("conta.ativo = true")
    .getMany();
  return contas.length === new Set(ids).size;
}

// ─── GET /transferencias ─────────────────────────────────────────────────────
lancamentosRouter.get("/transferencias", async (req: AuthRequest, res: Response) => {
  const rows = await AppDataSource.query(
    `SELECT t.*, origem.apelido AS conta_origem_apelido, destino.apelido AS conta_destino_apelido
     FROM transferencias_contas t
     JOIN contas origem ON origem.id_conta = t.id_conta_origem
     JOIN contas destino ON destino.id_conta = t.id_conta_destino
     WHERE t.id_empresa = $1
     ORDER BY t.data DESC, t.id_transferencia DESC`,
    [req.user!.id_empresa]
  );
  return res.json(rows);
});

// ─── POST /transferencias ────────────────────────────────────────────────────
lancamentosRouter.post("/transferencias", async (req: AuthRequest, res: Response) => {
  const parse = transferenciaBodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
  const idEmpresa = req.user!.id_empresa;
  const bloqueioNovo=await verificarPeriodoFinanceiro(idEmpresa,parse.data.data);if(bloqueioNovo)return res.status(409).json({error:bloqueioNovo});
  if (!(await validarContasTransferencia(idEmpresa, [parse.data.id_conta_origem, parse.data.id_conta_destino]))) {
    return res.status(400).json({ error: "As contas de origem e destino devem pertencer à empresa." });
  }

  const repo = AppDataSource.getRepository(TransferenciaConta);
  const saved = await repo.save(repo.create({
    ...parse.data,
    valor: parse.data.valor.toFixed(2),
    id_empresa: idEmpresa,
    id_usuario: req.user!.id_usuario,
  }));
  await AuditoriaService.registrar(req, "transferencias_contas", "CREATE", saved.id_transferencia, undefined, {
    id_conta_origem: saved.id_conta_origem, id_conta_destino: saved.id_conta_destino,
    descricao: saved.descricao, valor: saved.valor, data: saved.data,
  }, `Transferência criada — ${saved.descricao}, valor ${saved.valor}`);
  return res.status(201).json(saved);
});

// ─── PUT /transferencias/:id ─────────────────────────────────────────────────
lancamentosRouter.put("/transferencias/:id", async (req: AuthRequest, res: Response) => {
  const parse = transferenciaBodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
  const idEmpresa = req.user!.id_empresa;
  const bloqueio=await verificarPeriodoFinanceiro(idEmpresa,parse.data.data);if(bloqueio)return res.status(409).json({error:bloqueio});
  if (!(await validarContasTransferencia(idEmpresa, [parse.data.id_conta_origem, parse.data.id_conta_destino]))) {
    return res.status(400).json({ error: "As contas de origem e destino devem pertencer à empresa." });
  }

  const repo = AppDataSource.getRepository(TransferenciaConta);
  const transferencia = await repo.findOne({ where: { id_transferencia: Number(req.params.id), id_empresa: idEmpresa } });
  if (!transferencia) return res.status(404).json({ error: "Transferência não encontrada" });
  const bloqueioAntigo=await verificarPeriodoFinanceiro(req.user!.id_empresa,transferencia.data);if(bloqueioAntigo)return res.status(409).json({error:bloqueioAntigo});
  const valoresAntigos = { id_conta_origem: transferencia.id_conta_origem, id_conta_destino: transferencia.id_conta_destino, descricao: transferencia.descricao, valor: transferencia.valor, data: transferencia.data };
  Object.assign(transferencia, parse.data, { valor: parse.data.valor.toFixed(2) });
  const saved = await repo.save(transferencia);
  await AuditoriaService.registrar(req, "transferencias_contas", "UPDATE", saved.id_transferencia, valoresAntigos, {
    id_conta_origem: saved.id_conta_origem, id_conta_destino: saved.id_conta_destino,
    descricao: saved.descricao, valor: saved.valor, data: saved.data,
  }, `Transferência editada — ${saved.descricao}`);
  return res.json(saved);
});

// ─── DELETE /transferencias/:id ──────────────────────────────────────────────
lancamentosRouter.delete("/transferencias/:id", async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(TransferenciaConta);
  const transferencia = await repo.findOne({ where: { id_transferencia: Number(req.params.id), id_empresa: req.user!.id_empresa } });
  if (!transferencia) return res.status(404).json({ error: "Transferência não encontrada" });
  const bloqueio=await verificarPeriodoFinanceiro(req.user!.id_empresa,transferencia.data);if(bloqueio)return res.status(409).json({error:bloqueio});
  const valoresAntigos = { id_conta_origem: transferencia.id_conta_origem, id_conta_destino: transferencia.id_conta_destino, descricao: transferencia.descricao, valor: transferencia.valor, data: transferencia.data };
  await repo.remove(transferencia);
  await AuditoriaService.registrar(req, "transferencias_contas", "DELETE", Number(req.params.id), valoresAntigos, undefined, `Transferência excluída — ${transferencia.descricao}, valor ${transferencia.valor}`);
  return res.status(204).send();
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
  const bloqueio=await verificarPeriodoFinanceiro(idEmpresa,data.data);if(bloqueio)return res.status(409).json({error:bloqueio});
  if (data.id_conta_contabil && !(await contaContabilAceitaLancamento(data.id_conta_contabil, idEmpresa, data.tipo))) {
    return res.status(400).json({ error: "Selecione uma conta contábil analítica e compatível com o tipo do lançamento." });
  }

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
  await AuditoriaService.registrar(req, "lancamentos_manuais", "CREATE", saved.id_lancamento, undefined, {
    tipo: saved.tipo, id_conta: saved.id_conta, id_loteamento: saved.id_loteamento, descricao: saved.descricao, valor: saved.valor, data: saved.data,
  }, `Lançamento manual criado — ${saved.descricao}, valor ${saved.valor}`);

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
  const bloqueio=await verificarPeriodoFinanceiro(req.user!.id_empresa,parse.data.data??lancamento.data);if(bloqueio)return res.status(409).json({error:bloqueio});
  const valoresAntigos = { tipo: lancamento.tipo, id_conta: lancamento.id_conta, id_loteamento: lancamento.id_loteamento, descricao: lancamento.descricao, valor: lancamento.valor, data: lancamento.data };

  const { valor, rateio, ...rest } = parse.data;

  const contaContabil = rest.id_conta_contabil ?? lancamento.id_conta_contabil;
  const tipoLancamento = rest.tipo ?? lancamento.tipo;
  if (contaContabil && !(await contaContabilAceitaLancamento(contaContabil, req.user!.id_empresa, tipoLancamento))) {
    return res.status(400).json({ error: "Selecione uma conta contábil analítica e compatível com o tipo do lançamento." });
  }

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
  await AuditoriaService.registrar(req, "lancamentos_manuais", "UPDATE", saved.id_lancamento, valoresAntigos, {
    tipo: saved.tipo, id_conta: saved.id_conta, id_loteamento: saved.id_loteamento, descricao: saved.descricao, valor: saved.valor, data: saved.data,
  }, `Lançamento manual editado — ${saved.descricao}`);

  return res.json(saved);
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
lancamentosRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(LancamentoManual);
  const lancamento = await repo.findOne({
    where: { id_lancamento: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!lancamento) return res.status(404).json({ error: "Lançamento não encontrado" });
  const bloqueio=await verificarPeriodoFinanceiro(req.user!.id_empresa,lancamento.data);if(bloqueio)return res.status(409).json({error:bloqueio});

  await repo.remove(lancamento);

  const logRepo = AppDataSource.getRepository(Log);
  await logRepo.save(logRepo.create({
    id_usuario: req.user!.id_usuario,
    servico: "lancamento_manual_excluir",
    url: `/api/lancamentos/${req.params.id}`,
    log: `Lançamento manual ${req.params.id} (${lancamento.tipo}) excluído — ${lancamento.descricao} — valor=${lancamento.valor}`,
  }));
  await AuditoriaService.registrar(req, "lancamentos_manuais", "DELETE", Number(req.params.id), {
    tipo: lancamento.tipo, id_conta: lancamento.id_conta, id_loteamento: lancamento.id_loteamento, descricao: lancamento.descricao, valor: lancamento.valor, data: lancamento.data,
  }, undefined, `Lançamento manual excluído — ${lancamento.descricao}, valor ${lancamento.valor}`);

  return res.status(204).send();
});
