"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lancamentosRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const LancamentoManual_1 = require("../../entities/LancamentoManual");
const LancamentoRateio_1 = require("../../entities/LancamentoRateio");
const Conta_1 = require("../../entities/Conta");
const TransferenciaConta_1 = require("../../entities/TransferenciaConta");
const Log_1 = require("../../entities/Log");
const auth_1 = require("../../middleware/auth");
const AuditoriaService_1 = require("../../services/AuditoriaService");
const plano_contas_1 = require("../../utils/plano-contas");
const PeriodoFinanceiroService_1 = require("../../services/PeriodoFinanceiroService");
const anexo_financeiro_1 = require("../../utils/anexo-financeiro");
exports.lancamentosRouter = (0, express_1.Router)();
exports.lancamentosRouter.use(auth_1.requireAuth, (0, auth_1.requireFeature)("module_despesas"));
const lancamentoRateioItemSchema = zod_1.z.object({
    id_loteamento: zod_1.z.number().int().positive(),
    percentual: zod_1.z.number().positive().max(100),
});
const lancamentoBodyObjectSchema = zod_1.z.object({
    id_conta: zod_1.z.number().int().positive(),
    id_loteamento: zod_1.z.number().int().positive().optional().nullable(),
    tipo: zod_1.z.enum(["receita", "despesa"]),
    id_conta_contabil: zod_1.z.number().int().positive().optional().nullable(),
    id_fornecedor: zod_1.z.number().int().positive().optional().nullable(),
    descricao: zod_1.z.string().min(1).max(300),
    valor: zod_1.z.number().positive(),
    data: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Rateio entre loteamentos (ex: despesa que atende mais de um empreendimento).
    // Quando informado, "id_loteamento" deve ficar vazio e a soma dos percentuais = 100.
    rateio: zod_1.z.array(lancamentoRateioItemSchema).optional(),
    ...anexo_financeiro_1.anexoFinanceiroCampos,
});
const lancamentoBodySchema = lancamentoBodyObjectSchema
    .superRefine(anexo_financeiro_1.refinarAnexoFinanceiro)
    .refine((d) => !d.rateio || d.rateio.length === 0 || d.id_loteamento == null, {
    message: 'Ao ratear entre loteamentos, deixe o campo "Loteamento" em branco.',
    path: ["id_loteamento"],
})
    .refine((d) => {
    if (!d.rateio || d.rateio.length === 0)
        return true;
    const soma = d.rateio.reduce((s, r) => s + r.percentual, 0);
    return Math.abs(soma - 100) < 0.5;
}, { message: "A soma dos percentuais do rateio deve ser 100%.", path: ["rateio"] });
const listQuerySchema = zod_1.z.object({
    id_conta: zod_1.z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
    tipo: zod_1.z.enum(["receita", "despesa"]).optional(),
    id_loteamento: zod_1.z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const transferenciaBodySchema = zod_1.z.object({
    id_conta_origem: zod_1.z.number().int().positive(),
    id_conta_destino: zod_1.z.number().int().positive(),
    descricao: zod_1.z.string().trim().min(1).max(300),
    valor: zod_1.z.number().positive(),
    data: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((data) => data.id_conta_origem !== data.id_conta_destino, {
    message: "As contas de origem e destino devem ser diferentes.",
    path: ["id_conta_destino"],
});
async function validarContasTransferencia(idEmpresa, ids) {
    const contas = await data_source_1.AppDataSource.getRepository(Conta_1.Conta)
        .createQueryBuilder("conta")
        .where("conta.id_empresa = :idEmpresa", { idEmpresa })
        .andWhere("conta.id_conta IN (:...ids)", { ids })
        .andWhere("conta.ativo = true")
        .getMany();
    return contas.length === new Set(ids).size;
}
// ─── GET /transferencias ─────────────────────────────────────────────────────
exports.lancamentosRouter.get("/transferencias", async (req, res) => {
    const rows = await data_source_1.AppDataSource.query(`SELECT t.*, origem.apelido AS conta_origem_apelido, destino.apelido AS conta_destino_apelido
     FROM transferencias_contas t
     JOIN contas origem ON origem.id_conta = t.id_conta_origem
     JOIN contas destino ON destino.id_conta = t.id_conta_destino
     WHERE t.id_empresa = $1
     ORDER BY t.data DESC, t.id_transferencia DESC`, [req.user.id_empresa]);
    return res.json(rows);
});
// ─── POST /transferencias ────────────────────────────────────────────────────
exports.lancamentosRouter.post("/transferencias", async (req, res) => {
    const parse = transferenciaBodySchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
    const idEmpresa = req.user.id_empresa;
    const bloqueioNovo = await (0, PeriodoFinanceiroService_1.verificarPeriodoFinanceiroContas)(idEmpresa, parse.data.data, [parse.data.id_conta_origem, parse.data.id_conta_destino]);
    if (bloqueioNovo)
        return res.status(409).json({ error: bloqueioNovo });
    const retroativo = await (0, PeriodoFinanceiroService_1.verificarPermissaoRetroativa)(req.user, parse.data.data);
    if (retroativo)
        return res.status(403).json({ error: retroativo });
    if (!(await validarContasTransferencia(idEmpresa, [parse.data.id_conta_origem, parse.data.id_conta_destino]))) {
        return res.status(400).json({ error: "As contas de origem e destino devem pertencer à empresa." });
    }
    const repo = data_source_1.AppDataSource.getRepository(TransferenciaConta_1.TransferenciaConta);
    const saved = await repo.save(repo.create({
        ...parse.data,
        valor: parse.data.valor.toFixed(2),
        id_empresa: idEmpresa,
        id_usuario: req.user.id_usuario,
    }));
    await AuditoriaService_1.AuditoriaService.registrar(req, "transferencias_contas", "CREATE", saved.id_transferencia, undefined, {
        id_conta_origem: saved.id_conta_origem, id_conta_destino: saved.id_conta_destino,
        descricao: saved.descricao, valor: saved.valor, data: saved.data,
    }, `Transferência criada — ${saved.descricao}, valor ${saved.valor}`);
    return res.status(201).json(saved);
});
// ─── PUT /transferencias/:id ─────────────────────────────────────────────────
exports.lancamentosRouter.put("/transferencias/:id", async (req, res) => {
    const parse = transferenciaBodySchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
    const idEmpresa = req.user.id_empresa;
    const bloqueio = await (0, PeriodoFinanceiroService_1.verificarPeriodoFinanceiroContas)(idEmpresa, parse.data.data, [parse.data.id_conta_origem, parse.data.id_conta_destino]);
    if (bloqueio)
        return res.status(409).json({ error: bloqueio });
    const retroativo = await (0, PeriodoFinanceiroService_1.verificarPermissaoRetroativa)(req.user, parse.data.data);
    if (retroativo)
        return res.status(403).json({ error: retroativo });
    if (!(await validarContasTransferencia(idEmpresa, [parse.data.id_conta_origem, parse.data.id_conta_destino]))) {
        return res.status(400).json({ error: "As contas de origem e destino devem pertencer à empresa." });
    }
    const repo = data_source_1.AppDataSource.getRepository(TransferenciaConta_1.TransferenciaConta);
    const transferencia = await repo.findOne({ where: { id_transferencia: Number(req.params.id), id_empresa: idEmpresa } });
    if (!transferencia)
        return res.status(404).json({ error: "Transferência não encontrada" });
    const bloqueioAntigo = await (0, PeriodoFinanceiroService_1.verificarPeriodoFinanceiroContas)(req.user.id_empresa, transferencia.data, [transferencia.id_conta_origem, transferencia.id_conta_destino]);
    if (bloqueioAntigo)
        return res.status(409).json({ error: bloqueioAntigo });
    const valoresAntigos = { id_conta_origem: transferencia.id_conta_origem, id_conta_destino: transferencia.id_conta_destino, descricao: transferencia.descricao, valor: transferencia.valor, data: transferencia.data };
    Object.assign(transferencia, parse.data, { valor: parse.data.valor.toFixed(2) });
    const saved = await repo.save(transferencia);
    await AuditoriaService_1.AuditoriaService.registrar(req, "transferencias_contas", "UPDATE", saved.id_transferencia, valoresAntigos, {
        id_conta_origem: saved.id_conta_origem, id_conta_destino: saved.id_conta_destino,
        descricao: saved.descricao, valor: saved.valor, data: saved.data,
    }, `Transferência editada — ${saved.descricao}`);
    return res.json(saved);
});
// ─── DELETE /transferencias/:id ──────────────────────────────────────────────
exports.lancamentosRouter.delete("/transferencias/:id", (0, auth_1.requirePermission)("financeiro_excluir"), async (req, res) => {
    const repo = data_source_1.AppDataSource.getRepository(TransferenciaConta_1.TransferenciaConta);
    const transferencia = await repo.findOne({ where: { id_transferencia: Number(req.params.id), id_empresa: req.user.id_empresa } });
    if (!transferencia)
        return res.status(404).json({ error: "Transferência não encontrada" });
    const bloqueio = await (0, PeriodoFinanceiroService_1.verificarPeriodoFinanceiroContas)(req.user.id_empresa, transferencia.data, [transferencia.id_conta_origem, transferencia.id_conta_destino]);
    if (bloqueio)
        return res.status(409).json({ error: bloqueio });
    const valoresAntigos = { id_conta_origem: transferencia.id_conta_origem, id_conta_destino: transferencia.id_conta_destino, descricao: transferencia.descricao, valor: transferencia.valor, data: transferencia.data };
    await repo.remove(transferencia);
    await AuditoriaService_1.AuditoriaService.registrar(req, "transferencias_contas", "DELETE", Number(req.params.id), valoresAntigos, undefined, `Transferência excluída — ${transferencia.descricao}, valor ${transferencia.valor}`);
    return res.status(204).send();
});
// ─── GET / ────────────────────────────────────────────────────────────────────
exports.lancamentosRouter.get("/", async (req, res) => {
    const parse = listQuerySchema.safeParse(req.query);
    if (!parse.success)
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parse.error.issues });
    const { id_conta, tipo, id_loteamento, from, to } = parse.data;
    const repo = data_source_1.AppDataSource.getRepository(LancamentoManual_1.LancamentoManual);
    const qb = repo
        .createQueryBuilder("l")
        .where("l.id_empresa = :id_empresa", { id_empresa: req.user.id_empresa });
    if (id_conta)
        qb.andWhere("l.id_conta = :id_conta", { id_conta });
    if (tipo)
        qb.andWhere("l.tipo = :tipo", { tipo });
    if (id_loteamento)
        qb.andWhere("l.id_loteamento = :id_loteamento", { id_loteamento });
    if (from)
        qb.andWhere("l.data >= :from", { from });
    if (to)
        qb.andWhere("l.data <= :to", { to });
    qb.orderBy("l.data", "DESC").addOrderBy("l.id_lancamento", "DESC");
    const lancamentos = await qb.getMany();
    const rateioRows = (await data_source_1.AppDataSource.query(`SELECT r.id_lancamento, r.id_loteamento, r.percentual, lo.nome AS loteamento_nome
     FROM lancamento_rateio r
     JOIN loteamentos lo ON lo.id_loteamento = r.id_loteamento
     WHERE r.id_empresa = $1`, [req.user.id_empresa]));
    const rateioPorLancamento = new Map();
    for (const r of rateioRows) {
        const lista = rateioPorLancamento.get(r.id_lancamento) ?? [];
        lista.push(r);
        rateioPorLancamento.set(r.id_lancamento, lista);
    }
    const resultado = lancamentos.map((l) => ({ ...l, rateio: rateioPorLancamento.get(l.id_lancamento) ?? [] }));
    return res.json(resultado);
});
// ─── POST / ───────────────────────────────────────────────────────────────────
exports.lancamentosRouter.post("/", async (req, res) => {
    const parse = lancamentoBodySchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
    const { rateio, ...data } = parse.data;
    const idEmpresa = req.user.id_empresa;
    const bloqueio = await (0, PeriodoFinanceiroService_1.verificarPeriodoFinanceiro)(idEmpresa, data.data, data.id_conta);
    if (bloqueio)
        return res.status(409).json({ error: bloqueio });
    const retroativo = await (0, PeriodoFinanceiroService_1.verificarPermissaoRetroativa)(req.user, data.data);
    if (retroativo)
        return res.status(403).json({ error: retroativo });
    if (data.id_conta_contabil && !(await (0, plano_contas_1.contaContabilAceitaLancamento)(data.id_conta_contabil, idEmpresa, data.tipo))) {
        return res.status(400).json({ error: "Selecione uma conta contábil analítica e compatível com o tipo do lançamento." });
    }
    const repo = data_source_1.AppDataSource.getRepository(LancamentoManual_1.LancamentoManual);
    const lancamento = repo.create({
        ...data,
        valor: data.valor.toFixed(2),
        id_empresa: idEmpresa,
        id_usuario: req.user.id_usuario,
    });
    const saved = await repo.save(lancamento);
    if (rateio && rateio.length > 0) {
        const rateioRepo = data_source_1.AppDataSource.getRepository(LancamentoRateio_1.LancamentoRateio);
        await rateioRepo.save(rateio.map((r) => rateioRepo.create({
            id_empresa: idEmpresa,
            id_lancamento: saved.id_lancamento,
            id_loteamento: r.id_loteamento,
            percentual: r.percentual.toFixed(2),
        })));
    }
    const logRepo = data_source_1.AppDataSource.getRepository(Log_1.Log);
    await logRepo.save(logRepo.create({
        id_usuario: req.user.id_usuario,
        servico: "lancamento_manual_criar",
        url: "/api/lancamentos",
        log: `Lançamento manual ${saved.id_lancamento} (${saved.tipo}) criado — ${saved.descricao} — valor=${saved.valor}`,
        query: JSON.stringify(parse.data),
    }));
    await AuditoriaService_1.AuditoriaService.registrar(req, "lancamentos_manuais", "CREATE", saved.id_lancamento, undefined, {
        tipo: saved.tipo, id_conta: saved.id_conta, id_loteamento: saved.id_loteamento, descricao: saved.descricao, valor: saved.valor, data: saved.data,
    }, `Lançamento manual criado — ${saved.descricao}, valor ${saved.valor}`);
    return res.status(201).json(saved);
});
// ─── PUT /:id ─────────────────────────────────────────────────────────────────
exports.lancamentosRouter.put("/:id", async (req, res) => {
    const parse = lancamentoBodyObjectSchema.partial().superRefine(anexo_financeiro_1.refinarAnexoFinanceiro).safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
    const repo = data_source_1.AppDataSource.getRepository(LancamentoManual_1.LancamentoManual);
    const lancamento = await repo.findOne({
        where: { id_lancamento: Number(req.params.id), id_empresa: req.user.id_empresa },
    });
    if (!lancamento)
        return res.status(404).json({ error: "Lançamento não encontrado" });
    const bloqueio = await (0, PeriodoFinanceiroService_1.verificarPeriodoFinanceiroContas)(req.user.id_empresa, parse.data.data ?? lancamento.data, [lancamento.id_conta, parse.data.id_conta ?? lancamento.id_conta]);
    if (bloqueio)
        return res.status(409).json({ error: bloqueio });
    const retroativo = await (0, PeriodoFinanceiroService_1.verificarPermissaoRetroativa)(req.user, parse.data.data ?? lancamento.data);
    if (retroativo)
        return res.status(403).json({ error: retroativo });
    const valoresAntigos = { tipo: lancamento.tipo, id_conta: lancamento.id_conta, id_loteamento: lancamento.id_loteamento, descricao: lancamento.descricao, valor: lancamento.valor, data: lancamento.data };
    const { valor, rateio, ...rest } = parse.data;
    const contaContabil = rest.id_conta_contabil ?? lancamento.id_conta_contabil;
    const tipoLancamento = rest.tipo ?? lancamento.tipo;
    if (contaContabil && !(await (0, plano_contas_1.contaContabilAceitaLancamento)(contaContabil, req.user.id_empresa, tipoLancamento))) {
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
    if (valor !== undefined)
        lancamento.valor = valor.toFixed(2);
    const saved = await repo.save(lancamento);
    if (rateio !== undefined) {
        const rateioRepo = data_source_1.AppDataSource.getRepository(LancamentoRateio_1.LancamentoRateio);
        await rateioRepo.delete({ id_lancamento: lancamento.id_lancamento });
        if (rateio.length > 0) {
            await rateioRepo.save(rateio.map((r) => rateioRepo.create({
                id_empresa: req.user.id_empresa,
                id_lancamento: lancamento.id_lancamento,
                id_loteamento: r.id_loteamento,
                percentual: r.percentual.toFixed(2),
            })));
        }
    }
    await AuditoriaService_1.AuditoriaService.registrar(req, "lancamentos_manuais", "UPDATE", saved.id_lancamento, valoresAntigos, {
        tipo: saved.tipo, id_conta: saved.id_conta, id_loteamento: saved.id_loteamento, descricao: saved.descricao, valor: saved.valor, data: saved.data,
    }, `Lançamento manual editado — ${saved.descricao}`);
    return res.json(saved);
});
// ─── DELETE /:id ──────────────────────────────────────────────────────────────
exports.lancamentosRouter.delete("/:id", (0, auth_1.requirePermission)("financeiro_excluir"), async (req, res) => {
    const repo = data_source_1.AppDataSource.getRepository(LancamentoManual_1.LancamentoManual);
    const lancamento = await repo.findOne({
        where: { id_lancamento: Number(req.params.id), id_empresa: req.user.id_empresa },
    });
    if (!lancamento)
        return res.status(404).json({ error: "Lançamento não encontrado" });
    const bloqueio = await (0, PeriodoFinanceiroService_1.verificarPeriodoFinanceiro)(req.user.id_empresa, lancamento.data, lancamento.id_conta);
    if (bloqueio)
        return res.status(409).json({ error: bloqueio });
    await repo.remove(lancamento);
    const logRepo = data_source_1.AppDataSource.getRepository(Log_1.Log);
    await logRepo.save(logRepo.create({
        id_usuario: req.user.id_usuario,
        servico: "lancamento_manual_excluir",
        url: `/api/lancamentos/${req.params.id}`,
        log: `Lançamento manual ${req.params.id} (${lancamento.tipo}) excluído — ${lancamento.descricao} — valor=${lancamento.valor}`,
    }));
    await AuditoriaService_1.AuditoriaService.registrar(req, "lancamentos_manuais", "DELETE", Number(req.params.id), {
        tipo: lancamento.tipo, id_conta: lancamento.id_conta, id_loteamento: lancamento.id_loteamento, descricao: lancamento.descricao, valor: lancamento.valor, data: lancamento.data,
    }, undefined, `Lançamento manual excluído — ${lancamento.descricao}, valor ${lancamento.valor}`);
    return res.status(204).send();
});
