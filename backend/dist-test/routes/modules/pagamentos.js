"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pagamentosRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const Pagamento_1 = require("../../entities/Pagamento");
const Log_1 = require("../../entities/Log");
const Empresa_1 = require("../../entities/Empresa");
const Conta_1 = require("../../entities/Conta");
const auth_1 = require("../../middleware/auth");
const date_only_1 = require("../../utils/date-only");
const AuditoriaService_1 = require("../../services/AuditoriaService");
const PeriodoFinanceiroService_1 = require("../../services/PeriodoFinanceiroService");
exports.pagamentosRouter = (0, express_1.Router)();
exports.pagamentosRouter.use(auth_1.requireAuth, (0, auth_1.requireFeature)("module_pagamentos"));
const baixaSchema = zod_1.z.object({
    pago_data: zod_1.z.string(),
    valor_pago: zod_1.z.number().positive(),
    id_conta: zod_1.z.number().int().positive({ message: "Informe a conta que receberá o pagamento." }),
    // Encargos calculados/ajustados pelo frontend (dispensar = 0)
    multa_override: zod_1.z.number().min(0).optional().nullable(),
    juros_override: zod_1.z.number().min(0).optional().nullable(),
    desconto: zod_1.z.number().min(0).optional().nullable(),
});
const listPagamentosQuerySchema = zod_1.z.object({
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    id_cliente: zod_1.z
        .string()
        .regex(/^\d+$/)
        .transform((v) => parseInt(v, 10))
        .optional(),
});
exports.pagamentosRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const repo = data_source_1.AppDataSource.getRepository(Pagamento_1.Pagamento);
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
        .where("(venda.status IS NULL OR venda.status <> :cancelada)", { cancelada: "cancelada" });
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
exports.pagamentosRouter.get("/atrasados", auth_1.requireAuth, async (req, res) => {
    const repo = data_source_1.AppDataSource.getRepository(Pagamento_1.Pagamento);
    const qb = repo
        .createQueryBuilder("pagamento")
        .leftJoin("pagamento.venda", "venda")
        .where("pagamento.vencimento < CURRENT_DATE")
        .andWhere("pagamento.situacao = :situacao", { situacao: "aberto" })
        .andWhere("(venda.status IS NULL OR venda.status <> :cancelada)", { cancelada: "cancelada" });
    if (req.user?.id_empresa) {
        qb.andWhere("pagamento.id_empresa = :id_empresa", {
            id_empresa: req.user.id_empresa,
        });
    }
    const atrasados = await qb.orderBy("pagamento.vencimento", "ASC").getMany();
    return res.json(atrasados);
});
// ─── GET /a-receber — dívida em aberto por loteamento e/ou lote ──────────────
// Precisa vir antes de "/:id", senão a rota dinâmica captura o caminho.
const aReceberQuerySchema = zod_1.z.object({
    id_loteamento: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    id_lote: zod_1.z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
    situacao: zod_1.z.enum(["aberto", "atrasado", "todos"]).optional(),
});
exports.pagamentosRouter.get("/a-receber", async (req, res) => {
    const parse = aReceberQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parse.error.issues });
    }
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const { id_lote: idLote, situacao = "aberto" } = parse.data;
    const raw = parse.data.id_loteamento;
    const idsLoteamento = (Array.isArray(raw) ? raw : raw ? [raw] : [])
        .map((v) => parseInt(v, 10))
        .filter((n) => Number.isInteger(n) && n > 0);
    const params = [idEmpresa];
    const conditions = [
        "p.id_empresa = $1",
        "v.status <> 'cancelada'",
        "p.situacao = 'aberto'",
    ];
    if (idsLoteamento.length > 0) {
        params.push(idsLoteamento);
        conditions.push(`lo.id_loteamento = ANY($${params.length}::int[])`);
    }
    if (typeof idLote === "number") {
        params.push(idLote);
        conditions.push(`l.id_lote = $${params.length}`);
    }
    if (situacao === "atrasado")
        conditions.push("p.vencimento < CURRENT_DATE");
    const rows = await data_source_1.AppDataSource.query(`
    SELECT
      p.id_pagamento,
      c.id_cliente,
      c.nome AS cliente,
      lo.id_loteamento,
      lo.nome AS loteamento,
      l.id_lote,
      l.quadra,
      l.lote,
      v.id_venda,
      p.numero_parcela,
      v.parcelas AS total_parcelas,
      TO_CHAR(p.vencimento, 'YYYY-MM-DD') AS vencimento,
      p.valor,
      GREATEST(0, (CURRENT_DATE - p.vencimento)) AS dias_atraso
    FROM pagamentos p
    JOIN vendas v ON v.id_venda = p.id_venda
    JOIN clientes c ON c.id_cliente = v.id_cliente
    JOIN lotes l ON l.id_lote = v.id_lote
    JOIN loteamentos lo ON lo.id_loteamento = l.id_loteamento
    WHERE ${conditions.join(" AND ")}
    ORDER BY lo.nome ASC, l.quadra ASC, l.lote ASC, p.vencimento ASC
    `, params);
    const parcelas = rows.map((r) => ({
        id_pagamento: Number(r.id_pagamento),
        id_cliente: Number(r.id_cliente),
        cliente: r.cliente,
        id_loteamento: Number(r.id_loteamento),
        loteamento: r.loteamento,
        id_lote: Number(r.id_lote),
        quadra: r.quadra,
        lote: r.lote,
        id_venda: Number(r.id_venda),
        numeroParcela: Number(r.numero_parcela),
        totalParcelas: Number(r.total_parcelas),
        vencimento: r.vencimento,
        valor: Number(r.valor),
        diasAtraso: Number(r.dias_atraso),
    }));
    const totalAtrasado = parcelas.filter((p) => p.diasAtraso > 0).reduce((a, p) => a + p.valor, 0);
    const totalAVencer = parcelas.filter((p) => p.diasAtraso === 0).reduce((a, p) => a + p.valor, 0);
    return res.json({
        parcelas,
        totalEmAberto: totalAtrasado + totalAVencer,
        totalAtrasado,
        totalAVencer,
        qtdAtrasadas: parcelas.filter((p) => p.diasAtraso > 0).length,
        qtdAVencer: parcelas.filter((p) => p.diasAtraso === 0).length,
    });
});
exports.pagamentosRouter.get("/:id", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const repo = data_source_1.AppDataSource.getRepository(Pagamento_1.Pagamento);
    const where = { id_pagamento: Number(id) };
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
exports.pagamentosRouter.put("/:id", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const repo = data_source_1.AppDataSource.getRepository(Pagamento_1.Pagamento);
    const pagamento = await repo.findOne({ where: { id_pagamento: Number(id) } });
    if (!pagamento)
        return res.status(404).json({ error: "Pagamento não encontrado" });
    const { vencimento } = req.body;
    if (vencimento)
        pagamento.vencimento = vencimento;
    const saved = await repo.save(pagamento);
    return res.json(saved);
});
exports.pagamentosRouter.post("/:id/baixa", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const parseResult = baixaSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const { pago_data, valor_pago, id_conta, multa_override, juros_override, desconto } = parseResult.data;
    const bloqueio = await (0, PeriodoFinanceiroService_1.verificarPeriodoFinanceiro)(req.user.id_empresa, pago_data, id_conta);
    if (bloqueio)
        return res.status(409).json({ error: bloqueio });
    const retroativo = await (0, PeriodoFinanceiroService_1.verificarPermissaoRetroativa)(req.user, pago_data);
    if (retroativo)
        return res.status(403).json({ error: retroativo });
    const pagamentoRepo = data_source_1.AppDataSource.getRepository(Pagamento_1.Pagamento);
    const logRepo = data_source_1.AppDataSource.getRepository(Log_1.Log);
    const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
    const contaRepo = data_source_1.AppDataSource.getRepository(Conta_1.Conta);
    const where = { id_pagamento: Number(id) };
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
    const valoresAntigos = { situacao: pagamento.situacao, pago_data: pagamento.pago_data, valor_pago: pagamento.valor_pago, id_conta: pagamento.id_conta };
    const conta = await contaRepo.findOne({
        where: { id_conta, id_empresa: pagamento.id_empresa, ativo: true },
    });
    if (!conta) {
        return res.status(400).json({ error: "Conta bancária inválida ou inativa." });
    }
    // Busca configurações de encargos da empresa
    const empresa = req.user?.id_empresa
        ? await empresaRepo.findOne({ where: { id_empresa: req.user.id_empresa } })
        : null;
    const multaPerc = empresa ? Number(empresa.multa_percentual) / 100 : 0.02;
    const jurosPercDia = empresa ? Number(empresa.juros_percentual_dia) / 100 : 0.002;
    const carenciaDias = empresa ? empresa.carencia_dias : 0;
    const dias_atraso = Math.max(0, (0, date_only_1.diferencaDiasCivis)(pagamento.vencimento, pago_data));
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
    await AuditoriaService_1.AuditoriaService.registrar(req, "pagamentos", "UPDATE", saved.id_pagamento, valoresAntigos, {
        situacao: saved.situacao, pago_data: saved.pago_data, valor_pago: saved.valor_pago, id_conta: saved.id_conta,
    }, `Recebimento confirmado — parcela ${saved.numero_parcela}, valor ${saved.valor_pago}`);
    return res.json(saved);
});
exports.pagamentosRouter.post("/retorno", (_req, res) => {
    return res.status(200).json({ message: "Retorno processado (stub)" });
});
// ─── POST /bulk-delete — Excluir múltiplos pagamentos ────────────────────────
exports.pagamentosRouter.post("/bulk-delete", auth_1.requireAuth, (0, auth_1.requirePermission)("financeiro_excluir"), async (req, res) => {
    const schema = zod_1.z.object({ ids: zod_1.z.array(zod_1.z.number().int().positive()).min(1) });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: "IDs inválidos", issues: parse.error.issues });
    }
    const { ids } = parse.data;
    const idEmpresa = Number(req.user?.id_empresa ?? 0);
    try {
        const registros = await data_source_1.AppDataSource.getRepository(Pagamento_1.Pagamento).find({ where: { id_empresa: idEmpresa } });
        const excluidos = registros.filter((p) => ids.includes(p.id_pagamento)).map((p) => ({
            id_pagamento: p.id_pagamento, id_venda: p.id_venda, numero_parcela: p.numero_parcela, situacao: p.situacao, valor: p.valor,
        }));
        const result = await data_source_1.AppDataSource.query(`DELETE FROM pagamentos WHERE id_pagamento = ANY($1::int[]) AND id_empresa = $2`, [ids, idEmpresa]);
        const deletados = result.rowCount ?? ids.length;
        const logRepo = data_source_1.AppDataSource.getRepository(Log_1.Log);
        await logRepo.save(logRepo.create({
            id_usuario: req.user?.id_usuario ?? 1,
            servico: "pagamento_bulk_delete",
            url: "/api/pagamentos/bulk-delete",
            log: `${deletados} pagamento(s) excluído(s): [${ids.join(",")}]`,
        }));
        for (const registro of excluidos) {
            await AuditoriaService_1.AuditoriaService.registrar(req, "pagamentos", "DELETE", registro.id_pagamento, registro, undefined, `Parcela excluída em lote — venda ${registro.id_venda}, parcela ${registro.numero_parcela}`);
        }
        return res.json({ deletados });
    }
    catch (err) {
        console.error("bulk-delete error:", err);
        return res.status(500).json({ error: "Erro interno ao excluir lançamentos" });
    }
});
// ─── POST /:id/estornar — Cancelar pagamento e voltar para aberto ─────────────
exports.pagamentosRouter.post("/:id/estornar", auth_1.requireAuth, (0, auth_1.requirePermission)("financeiro_estornar"), async (req, res) => {
    const { id } = req.params;
    const repo = data_source_1.AppDataSource.getRepository(Pagamento_1.Pagamento);
    const logRepo = data_source_1.AppDataSource.getRepository(Log_1.Log);
    const where = { id_pagamento: Number(id) };
    if (req.user?.id_empresa)
        where.id_empresa = req.user.id_empresa;
    const pagamento = await repo.findOne({ where });
    if (!pagamento)
        return res.status(404).json({ error: "Pagamento não encontrado" });
    const bloqueio = await (0, PeriodoFinanceiroService_1.verificarPeriodoFinanceiro)(req.user.id_empresa, pagamento.pago_data, pagamento.id_conta);
    if (bloqueio)
        return res.status(409).json({ error: bloqueio });
    if (pagamento.situacao !== "pago")
        return res.status(400).json({ error: "Este pagamento não está pago e não pode ser estornado." });
    const valoresAntigos = { situacao: pagamento.situacao, pago_data: pagamento.pago_data, valor_pago: pagamento.valor_pago, id_conta: pagamento.id_conta };
    pagamento.situacao = "aberto";
    pagamento.pago_data = null;
    pagamento.valor_pago = null;
    pagamento.id_conta = null;
    const saved = await repo.save(pagamento);
    const log = logRepo.create({
        id_usuario: req.user?.id_usuario ?? 1,
        servico: "pagamento_estorno",
        url: `/api/pagamentos/${id}/estornar`,
        log: `Pagamento ${saved.id_pagamento} estornado — voltou para aberto`,
    });
    await logRepo.save(log);
    await AuditoriaService_1.AuditoriaService.registrar(req, "pagamentos", "UPDATE", saved.id_pagamento, valoresAntigos, {
        situacao: saved.situacao, pago_data: saved.pago_data, valor_pago: saved.valor_pago, id_conta: saved.id_conta,
    }, `Recebimento cancelado — parcela ${saved.numero_parcela}`);
    return res.json(saved);
});
// ─── POST /reajuste — Reajuste percentual em parcelas em aberto ───────────────
exports.pagamentosRouter.post("/reajuste", auth_1.requireAuth, async (req, res) => {
    const schema = zod_1.z.object({
        id_cliente: zod_1.z.number().int().positive().optional(),
        percentual: zod_1.z.number().positive().max(100),
        id_venda: zod_1.z.number().int().positive().optional(),
        // intervalo por número de parcela
        parcela_de: zod_1.z.number().int().min(0).optional(),
        parcela_ate: zod_1.z.number().int().min(0).optional(),
        // intervalo por data de vencimento (YYYY-MM-DD)
        data_de: zod_1.z.string().optional(),
        data_ate: zod_1.z.string().optional(),
        // escopo de clientes
        escopo: zod_1.z.enum(["cliente", "loteamento", "todos"]).default("cliente"),
        id_loteamento: zod_1.z.number().int().positive().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
    }
    const { id_cliente, percentual, id_venda, parcela_de, parcela_ate, data_de, data_ate, escopo, id_loteamento } = parse.data;
    const id_empresa = req.user?.id_empresa;
    if (!id_empresa) {
        return res.status(400).json({ error: "Empresa não definida" });
    }
    if (escopo === "cliente" && !id_cliente) {
        return res.status(400).json({ error: "id_cliente obrigatório para escopo 'cliente'" });
    }
    if (escopo === "loteamento" && !id_loteamento) {
        return res.status(400).json({ error: "id_loteamento obrigatório para escopo 'loteamento'" });
    }
    const repo = data_source_1.AppDataSource.getRepository(Pagamento_1.Pagamento);
    const qb = repo
        .createQueryBuilder("p")
        .leftJoin("p.venda", "v")
        .leftJoin("v.lote", "lot")
        .leftJoin("lot.loteamento", "loteamento")
        .where("p.id_empresa = :id_empresa", { id_empresa })
        .andWhere("p.situacao = 'aberto'")
        .andWhere("p.tipo != 'entrada'");
    if (escopo === "cliente") {
        qb.andWhere("v.id_cliente = :id_cliente", { id_cliente });
    }
    else if (escopo === "loteamento") {
        qb.andWhere("loteamento.id_loteamento = :id_loteamento", { id_loteamento });
    }
    // escopo "todos" → sem filtro de cliente/loteamento
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
    // Filtro por data de vencimento
    if (data_de) {
        qb.andWhere("p.vencimento >= :data_de", { data_de });
    }
    if (data_ate) {
        qb.andWhere("p.vencimento <= :data_ate", { data_ate });
    }
    const parcelas = await qb.getMany();
    if (parcelas.length === 0) {
        return res.status(404).json({ error: "Nenhuma parcela em aberto encontrada para este intervalo." });
    }
    const fator = 1 + percentual / 100;
    const atualizadas = [];
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
