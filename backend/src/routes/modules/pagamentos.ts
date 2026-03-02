import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Pagamento } from "../../entities/Pagamento";
import { Log } from "../../entities/Log";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const pagamentosRouter = Router();

const baixaSchema = z.object({
  pago_data: z.string(),
  valor_pago: z.number().positive(),
  id_conta: z.number().int().positive(),
});

const listPagamentosQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

pagamentosRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const repo = AppDataSource.getRepository(Pagamento);

  const parseResult = listPagamentosQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Parâmetros de filtro inválidos", issues: parseResult.error.issues });
  }

  const { from, to } = parseResult.data;

  const qb = repo
    .createQueryBuilder("pagamento")
    .leftJoinAndSelect("pagamento.venda", "venda")
    .leftJoinAndSelect("venda.cliente", "cliente")
    .leftJoinAndSelect("venda.lote", "lote")
    .where("1=1");

  if (req.user?.id_empresa) {
    qb.andWhere("pagamento.id_empresa = :id_empresa", {
      id_empresa: req.user.id_empresa,
    });
  }

  if (from) {
    qb.andWhere("pagamento.vencimento >= :from", { from });
  }

  if (to) {
    qb.andWhere("pagamento.vencimento <= :to", { to });
  }

  const pagamentos = await qb.orderBy("pagamento.vencimento", "ASC").getMany();

  return res.json(pagamentos);
});

pagamentosRouter.get("/atrasados", requireAuth, async (req: AuthRequest, res) => {
  const repo = AppDataSource.getRepository(Pagamento);
  const hoje = new Date().toISOString().slice(0, 10);

  const qb = repo
    .createQueryBuilder("pagamento")
    .where("pagamento.vencimento < :hoje", { hoje })
    .andWhere("pagamento.situacao = :situacao", { situacao: "aberto" });

  if (req.user?.id_empresa) {
    qb.andWhere("pagamento.id_empresa = :id_empresa", {
      id_empresa: req.user.id_empresa,
    });
  }

  const atrasados = await qb.orderBy("pagamento.vencimento", "ASC").getMany();

  return res.json(atrasados);
});

pagamentosRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Pagamento);

  const where: Record<string, unknown> = { id_pagamento: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const pagamento = await repo.findOne({ where });

  if (!pagamento) {
    return res.status(404).json({ error: "Pagamento não encontrado" });
  }

  return res.json(pagamento);
});

pagamentosRouter.post("/:id/baixa", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parseResult = baixaSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const { pago_data, valor_pago, id_conta } = parseResult.data;

  const pagamentoRepo = AppDataSource.getRepository(Pagamento);
  const logRepo = AppDataSource.getRepository(Log);

  const where: Record<string, unknown> = { id_pagamento: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const pagamento = await pagamentoRepo.findOne({ where });

  if (!pagamento) {
    return res.status(404).json({ error: "Pagamento não encontrado" });
  }

  const vencimentoDate = new Date(pagamento.vencimento);
  const pagoDate = new Date(pago_data);
  const diffMs = pagoDate.getTime() - vencimentoDate.getTime();
  const dias_atraso = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  let multa = 0;
  let juros = 0;

  const valor = Number(pagamento.valor);

  if (dias_atraso > 0) {
    multa = valor * 0.02;
    juros = valor * 0.002 * dias_atraso;
  }

  const valorTotalCalculado = valor + multa + juros;

  pagamento.situacao = "pago";
  pagamento.pago_data = pago_data;
  pagamento.valor_pago = valor_pago.toFixed(2);
  pagamento.multa = multa.toFixed(2);
  pagamento.juros = juros.toFixed(2);
  pagamento.id_conta = id_conta;
  pagamento.id_usuario = req.user?.id_usuario ?? 1;

  const saved = await pagamentoRepo.save(pagamento);

  const log = logRepo.create({
    id_usuario: req.user?.id_usuario ?? 1,
    id_cliente: null,
    id_lote: null,
    servico: "pagamento_baixa",
    url: `/api/pagamentos/${id}/baixa`,
    log: `Pagamento ${saved.id_pagamento} baixado com dias_atraso=${dias_atraso} valor_total=${valorTotalCalculado.toFixed(2)}`,
    query: JSON.stringify(parseResult.data),
  });

  await logRepo.save(log);

  return res.json(saved);
});

pagamentosRouter.post("/retorno", (_req, res) => {
  return res.status(200).json({ message: "Retorno processado (stub)" });
});
