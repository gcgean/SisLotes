import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Pagamento } from "../../entities/Pagamento";
import { Log } from "../../entities/Log";
import { Empresa } from "../../entities/Empresa";
import { AuthRequest, requireAuth, requireFeature } from "../../middleware/auth";

export const pagamentosRouter = Router();
pagamentosRouter.use(requireAuth, requireFeature("module_pagamentos"));

const baixaSchema = z.object({
  pago_data: z.string(),
  valor_pago: z.number().positive(),
  id_conta: z.number().int().positive().optional().nullable(),
  // Encargos calculados/ajustados pelo frontend (dispensar = 0)
  multa_override: z.number().min(0).optional().nullable(),
  juros_override: z.number().min(0).optional().nullable(),
  desconto: z.number().min(0).optional().nullable(),
});

const listPagamentosQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  id_cliente: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => parseInt(v, 10))
    .optional(),
});

pagamentosRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const repo = AppDataSource.getRepository(Pagamento);

  const parseResult = listPagamentosQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Parâmetros de filtro inválidos", issues: parseResult.error.issues });
  }

  const { from, to, id_cliente } = parseResult.data;

  const qb = repo
    .createQueryBuilder("pagamento")
    .leftJoinAndSelect("pagamento.venda", "venda")
    .leftJoinAndSelect("venda.cliente", "cliente")
    .leftJoinAndSelect("venda.lote", "lote")
    .leftJoinAndSelect("lote.loteamento", "loteamento")
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

  if (typeof id_cliente === "number") {
    qb.andWhere("cliente.id_cliente = :id_cliente", { id_cliente });
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

// ─── PUT /:id — Alterar vencimento (e outros campos) de uma parcela ──────────
pagamentosRouter.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const repo = AppDataSource.getRepository(Pagamento);

  const pagamento = await repo.findOne({ where: { id_pagamento: Number(id) } });
  if (!pagamento) return res.status(404).json({ error: "Pagamento não encontrado" });

  const { vencimento } = req.body as { vencimento?: string };
  if (vencimento) pagamento.vencimento = vencimento;

  const saved = await repo.save(pagamento);
  return res.json(saved);
});

pagamentosRouter.post("/:id/baixa", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parseResult = baixaSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const { pago_data, valor_pago, id_conta, multa_override, juros_override, desconto } = parseResult.data;

  const pagamentoRepo = AppDataSource.getRepository(Pagamento);
  const logRepo = AppDataSource.getRepository(Log);
  const empresaRepo = AppDataSource.getRepository(Empresa);

  const where: Record<string, unknown> = { id_pagamento: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const pagamento = await pagamentoRepo.findOne({ where });

  if (!pagamento) {
    return res.status(404).json({ error: "Pagamento não encontrado" });
  }

  if (pagamento.situacao === "pago") {
    return res.status(409).json({ error: "Este pagamento já foi baixado.", situacao: "pago", pago_data: pagamento.pago_data, valor_pago: pagamento.valor_pago });
  }

  // Busca configurações de encargos da empresa
  const empresa = req.user?.id_empresa
    ? await empresaRepo.findOne({ where: { id_empresa: req.user.id_empresa } })
    : null;
  const multaPerc = empresa ? Number(empresa.multa_percentual) / 100 : 0.02;
  const jurosPercDia = empresa ? Number(empresa.juros_percentual_dia) / 100 : 0.002;
  const carenciaDias = empresa ? empresa.carencia_dias : 0;

  const vencimentoDate = new Date(pagamento.vencimento);
  const pagoDate = new Date(pago_data);
  const diffMs = pagoDate.getTime() - vencimentoDate.getTime();
  const dias_atraso = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const dias_efetivos = Math.max(0, dias_atraso - carenciaDias);

  const valor = Number(pagamento.valor);

  // Se frontend enviou override, usa; senão calcula com config da empresa
  let multa = multa_override != null ? multa_override : (dias_efetivos > 0 ? valor * multaPerc : 0);
  let juros = juros_override != null ? juros_override : (dias_efetivos > 0 ? valor * jurosPercDia * dias_efetivos : 0);
  const descontoVal = desconto ?? 0;

  const valorTotalCalculado = valor + multa + juros - descontoVal;

  pagamento.situacao = "pago";
  pagamento.pago_data = pago_data;
  pagamento.valor_pago = valor_pago.toFixed(2);
  pagamento.multa = multa.toFixed(2);
  pagamento.juros = juros.toFixed(2);
  pagamento.id_conta = id_conta ?? null;
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

// ─── POST /bulk-delete — Excluir múltiplos pagamentos ────────────────────────
pagamentosRouter.post("/bulk-delete", requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({ ids: z.array(z.number().int().positive()).min(1) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "IDs inválidos", issues: parse.error.issues });
  }

  const { ids } = parse.data;
  const repo = AppDataSource.getRepository(Pagamento);
  const logRepo = AppDataSource.getRepository(Log);

  const where: Record<string, unknown> = {};
  if (req.user?.id_empresa) where.id_empresa = req.user.id_empresa;

  // Busca apenas pagamentos da empresa do usuário (segurança multi-tenant)
  const pagamentos = await repo
    .createQueryBuilder("p")
    .where("p.id_pagamento IN (:...ids)", { ids })
    .andWhere("p.id_empresa = :id_empresa", { id_empresa: req.user?.id_empresa ?? 0 })
    .getMany();

  if (pagamentos.length === 0) {
    return res.status(404).json({ error: "Nenhum pagamento encontrado" });
  }

  await repo.remove(pagamentos);

  await logRepo.save(logRepo.create({
    id_usuario: req.user?.id_usuario ?? 1,
    servico: "pagamento_bulk_delete",
    url: "/api/pagamentos/bulk",
    log: `${pagamentos.length} pagamento(s) excluído(s): [${ids.join(",")}]`,
  }));

  return res.json({ deletados: pagamentos.length });
});

// ─── POST /:id/estornar — Cancelar pagamento e voltar para aberto ─────────────
pagamentosRouter.post("/:id/estornar", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const repo = AppDataSource.getRepository(Pagamento);
  const logRepo = AppDataSource.getRepository(Log);

  const where: Record<string, unknown> = { id_pagamento: Number(id) };
  if (req.user?.id_empresa) where.id_empresa = req.user.id_empresa;

  const pagamento = await repo.findOne({ where });

  if (!pagamento) return res.status(404).json({ error: "Pagamento não encontrado" });
  if (pagamento.situacao !== "pago") return res.status(400).json({ error: "Este pagamento não está pago e não pode ser estornado." });

  pagamento.situacao = "aberto";
  pagamento.pago_data = null as unknown as string;
  pagamento.valor_pago = null as unknown as string;
  pagamento.id_conta = null as unknown as number;

  const saved = await repo.save(pagamento);

  const log = logRepo.create({
    id_usuario: req.user?.id_usuario ?? 1,
    servico: "pagamento_estorno",
    url: `/api/pagamentos/${id}/estornar`,
    log: `Pagamento ${saved.id_pagamento} estornado — voltou para aberto`,
  });
  await logRepo.save(log);

  return res.json(saved);
});

// ─── POST /reajuste — Reajuste percentual em parcelas em aberto ───────────────
pagamentosRouter.post("/reajuste", requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    id_cliente: z.number().int().positive(),
    percentual: z.number().positive().max(100),
    id_venda: z.number().int().positive().optional(),
    parcela_de: z.number().int().min(0).optional(), // número da parcela inicial (inclusive)
    parcela_ate: z.number().int().min(0).optional(), // número da parcela final (inclusive)
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
  }

  const { id_cliente, percentual, id_venda, parcela_de, parcela_ate } = parse.data;
  const id_empresa = req.user?.id_empresa;

  if (!id_empresa) {
    return res.status(400).json({ error: "Empresa não definida" });
  }

  const repo = AppDataSource.getRepository(Pagamento);

  // Busca parcelas em aberto do cliente (filtra por empresa para segurança)
  const qb = repo
    .createQueryBuilder("p")
    .leftJoin("p.venda", "v")
    .where("p.id_empresa = :id_empresa", { id_empresa })
    .andWhere("p.situacao = 'aberto'")
    .andWhere("v.id_cliente = :id_cliente", { id_cliente });

  if (id_venda) {
    qb.andWhere("p.id_venda = :id_venda", { id_venda });
  }

  // Filtro por intervalo de número de parcela
  if (typeof parcela_de === "number") {
    qb.andWhere("p.numero_parcela >= :parcela_de", { parcela_de });
  }
  if (typeof parcela_ate === "number") {
    qb.andWhere("p.numero_parcela <= :parcela_ate", { parcela_ate });
  }

  const parcelas = await qb.getMany();

  if (parcelas.length === 0) {
    return res.status(404).json({ error: "Nenhuma parcela em aberto encontrada para este intervalo." });
  }

  const fator = 1 + percentual / 100;
  const atualizadas: Pagamento[] = [];

  for (const p of parcelas) {
    const valorAtual = Number(p.valor);
    p.valor = (valorAtual * fator).toFixed(2);
    p.reajustado = true;
    atualizadas.push(p);
  }

  await repo.save(atualizadas);

  return res.json({
    total_parcelas: atualizadas.length,
    percentual,
    parcelas_ids: atualizadas.map((p) => p.id_pagamento),
    mensagem: `${atualizadas.length} parcela(s) reajustada(s) em ${percentual}%.`,
  });
});
