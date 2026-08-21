"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contasRouter = void 0;
exports.deltaMovimentosEmpresa = deltaMovimentosEmpresa;
exports.saldoAtualGeralEmpresa = saldoAtualGeralEmpresa;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const Conta_1 = require("../../entities/Conta");
const auth_1 = require("../../middleware/auth");
const AuditoriaService_1 = require("../../services/AuditoriaService");
const ofx_1 = require("../../utils/ofx");
exports.contasRouter = (0, express_1.Router)();
const contaBodySchema = zod_1.z.object({
    apelido: zod_1.z.string().min(1),
    titular: zod_1.z.string().optional().nullable(),
    agencia: zod_1.z.string().optional().nullable(),
    conta: zod_1.z.string().optional().nullable(),
    convenio: zod_1.z.string().optional().nullable(),
    tipo: zod_1.z.enum(["banco", "caixa"]).optional(),
    saldo_inicial: zod_1.z.number().optional(),
    data_saldo_inicial: zod_1.z.string().optional().nullable(),
    ativo: zod_1.z.boolean().optional(),
});
// ─── GET / — lista contas com saldo atual; ?ativo=true|false filtra por status ─
exports.contasRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const idEmpresa = req.user?.id_empresa ?? 1;
    const conditions = ["c.id_empresa = $1"];
    const params = [idEmpresa];
    if (req.query.ativo !== undefined) {
        params.push(req.query.ativo === "true");
        conditions.push(`c.ativo = $${params.length}`);
    }
    const rows = await data_source_1.AppDataSource.query(`
    SELECT
      c.*,
      c.saldo_inicial
        + COALESCE((
            SELECT SUM(CASE WHEN mf.tipo = 'receita' THEN mf.valor ELSE -mf.valor END)
            FROM movimentos_financeiros mf
            WHERE mf.id_conta = c.id_conta
              AND (c.data_saldo_inicial IS NULL OR mf.data >= c.data_saldo_inicial)
          ), 0) AS saldo_atual
    FROM contas c
    WHERE ${conditions.join(" AND ")}
    ORDER BY c.apelido ASC
    `, params);
    const resultado = rows.map((r) => ({ ...r, saldo_atual: Number(r.saldo_atual ?? 0) }));
    return res.json(resultado);
});
// Soma o delta (créditos - débitos) das contas da empresa (ou de uma única conta,
// se idConta for informado), respeitando o corte de saldo inicial de cada conta.
// ateExclusive limita a data (< ateExclusive); sem ateExclusive, soma o histórico
// inteiro (usado para o saldo atual "de hoje").
async function deltaMovimentosEmpresa(idEmpresa, ateExclusive, idConta) {
    const params = [idEmpresa];
    let cutoff = "";
    if (ateExclusive) {
        params.push(ateExclusive);
        const idx = params.length;
        cutoff = `AND mf.data < $${idx}`;
    }
    let contaClause = "";
    if (idConta) {
        params.push(idConta);
        contaClause = `AND c.id_conta = $${params.length}`;
    }
    const rows = await data_source_1.AppDataSource.query(`
    SELECT
      COALESCE((
        SELECT SUM(CASE WHEN mf.tipo = 'receita' THEN mf.valor ELSE -mf.valor END)
        FROM movimentos_financeiros mf
        JOIN contas c ON c.id_conta = mf.id_conta
        WHERE c.id_empresa = $1
          AND mf.data >= COALESCE(c.data_saldo_inicial, '1900-01-01') ${cutoff} ${contaClause}
      ), 0) AS delta
    `, params);
    return Number(rows[0]?.delta ?? 0);
}
// Saldo real, hoje, somando todas as contas da empresa (saldo_inicial + movimentos
// já realizados). Usado como ponto de partida das projeções de fluxo de caixa.
async function saldoAtualGeralEmpresa(idEmpresa, idConta) {
    const params = [idEmpresa];
    let contaClause = "";
    if (idConta) {
        params.push(idConta);
        contaClause = `AND id_conta = $${params.length}`;
    }
    const rows = await data_source_1.AppDataSource.query(`SELECT COALESCE(SUM(saldo_inicial), 0) AS total FROM contas WHERE id_empresa = $1 ${contaClause}`, params);
    const saldoInicialTotal = Number(rows[0]?.total ?? 0);
    const delta = await deltaMovimentosEmpresa(idEmpresa, undefined, idConta);
    return saldoInicialTotal + delta;
}
// ─── GET /extrato-geral?from&to — extrato consolidado de todas as contas da
// empresa (estilo extrato bancário: saldo inicial/final do período, créditos e
// débitos em verde/vermelho, saldo corrente por linha e saldo atual geral) ────
exports.contasRouter.get("/extrato-geral", auth_1.requireAuth, async (req, res) => {
    const idEmpresa = req.user?.id_empresa ?? 1;
    const querySchema = zod_1.z.object({
        from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        id_conta: zod_1.z.coerce.number().int().positive().optional(),
    });
    const parse = querySchema.safeParse(req.query);
    if (!parse.success)
        return res.status(400).json({ error: "Informe from e to (YYYY-MM-DD)" });
    const { from, to, id_conta: idConta } = parse.data;
    const saldoInicialParams = [idEmpresa];
    const saldoInicialContaClause = idConta ? (saldoInicialParams.push(idConta), `AND id_conta = $${saldoInicialParams.length}`) : "";
    const movParams = [idEmpresa, from, to];
    const movContaClause = idConta ? (movParams.push(idConta), `AND c.id_conta = $${movParams.length}`) : "";
    const [saldoInicialRows, deltaAntes, movimentosRows] = await Promise.all([
        data_source_1.AppDataSource.query(`SELECT COALESCE(SUM(saldo_inicial), 0) AS total FROM contas WHERE id_empresa = $1 ${saldoInicialContaClause}`, saldoInicialParams),
        deltaMovimentosEmpresa(idEmpresa, from, idConta),
        data_source_1.AppDataSource.query(`
      SELECT TO_CHAR(mf.data, 'YYYY-MM-DD') AS data,
             CASE WHEN mf.tipo = 'receita' THEN 'entrada' ELSE 'saida' END AS movimento,
             mf.origem, mf.descricao, mf.valor,
             cat.nome AS conta_contabil, c.apelido AS conta_apelido, c.id_conta,
             CASE WHEN mf.origem = 'manual' THEN mf.id_origem ELSE NULL END AS id_lancamento,
             mf.id_transferencia
      FROM movimentos_financeiros mf
      JOIN contas c ON c.id_conta = mf.id_conta
      LEFT JOIN plano_de_contas cat ON cat.id_conta_contabil = mf.id_conta_contabil
      WHERE c.id_empresa = $1 AND mf.data >= $2 AND mf.data <= $3 ${movContaClause}
      ORDER BY data ASC, movimento ASC
      `, movParams),
    ]);
    const saldoInicialTotal = Number(saldoInicialRows[0]?.total ?? 0);
    const saldoInicialPeriodo = saldoInicialTotal + deltaAntes;
    let saldoCorrente = saldoInicialPeriodo;
    let totalCreditos = 0;
    let totalDebitos = 0;
    const movimentos = movimentosRows.map((m) => {
        const valor = Number(m.valor ?? 0);
        if (m.movimento === "entrada") {
            saldoCorrente += valor;
            totalCreditos += valor;
        }
        else {
            saldoCorrente -= valor;
            totalDebitos += valor;
        }
        return {
            data: m.data,
            movimento: m.movimento,
            origem: m.origem,
            descricao: m.descricao,
            valor,
            contaContabil: m.conta_contabil,
            contaApelido: m.conta_apelido,
            idConta: m.id_conta,
            idLancamento: m.id_lancamento,
            idTransferencia: m.id_transferencia,
            saldo: saldoCorrente,
        };
    });
    const deltaGeral = await deltaMovimentosEmpresa(idEmpresa, undefined, idConta);
    const saldoAtualGeral = saldoInicialTotal + deltaGeral;
    return res.json({
        saldoInicialPeriodo,
        saldoFinalPeriodo: saldoCorrente,
        totalCreditos,
        totalDebitos,
        saldoAtualGeral,
        movimentos,
    });
});
// ─── GET /:id/extrato?from&to — movimentos da conta no período, com saldo acumulado
exports.contasRouter.get("/:id/extrato", auth_1.requireAuth, async (req, res) => {
    const idEmpresa = req.user?.id_empresa ?? 1;
    const idConta = Number(req.params.id);
    const querySchema = zod_1.z.object({
        from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    });
    const parse = querySchema.safeParse(req.query);
    if (!parse.success)
        return res.status(400).json({ error: "Informe from e to (YYYY-MM-DD)" });
    const { from, to } = parse.data;
    const contaRepo = data_source_1.AppDataSource.getRepository(Conta_1.Conta);
    const conta = await contaRepo.findOne({ where: { id_conta: idConta, id_empresa: idEmpresa } });
    if (!conta)
        return res.status(404).json({ error: "Conta não encontrada" });
    const dataSaldoInicial = conta.data_saldo_inicial ?? "1900-01-01";
    const saldoInicialConta = Number(conta.saldo_inicial ?? 0);
    const [antesRows, movimentosRows] = await Promise.all([
        data_source_1.AppDataSource.query(`
      SELECT
        COALESCE((
          SELECT SUM(CASE WHEN mf.tipo = 'receita' THEN mf.valor ELSE -mf.valor END)
          FROM movimentos_financeiros mf
          WHERE mf.id_conta = $1 AND mf.data >= $2 AND mf.data < $3
        ), 0) AS delta
      `, [idConta, dataSaldoInicial, from]),
        data_source_1.AppDataSource.query(`
      SELECT TO_CHAR(mf.data, 'YYYY-MM-DD') AS data,
             CASE WHEN mf.tipo = 'receita' THEN 'entrada' ELSE 'saida' END AS movimento,
             mf.origem, mf.descricao, mf.valor, cat.nome AS conta_contabil
      FROM movimentos_financeiros mf
      LEFT JOIN plano_de_contas cat ON cat.id_conta_contabil = mf.id_conta_contabil
      WHERE mf.id_conta = $1 AND mf.data >= $2 AND mf.data <= $3
      ORDER BY data ASC
      `, [idConta, from, to]),
    ]);
    const saldoInicialPeriodo = saldoInicialConta + Number(antesRows[0]?.delta ?? 0);
    let saldoCorrente = saldoInicialPeriodo;
    const movimentos = movimentosRows.map((m) => {
        const valor = Number(m.valor ?? 0);
        saldoCorrente += m.movimento === "entrada" ? valor : -valor;
        return { data: m.data, movimento: m.movimento, origem: m.origem, descricao: m.descricao, valor, contaContabil: m.conta_contabil, saldo: saldoCorrente };
    });
    return res.json({
        conta: { id_conta: conta.id_conta, apelido: conta.apelido, tipo: conta.tipo },
        saldoInicialPeriodo,
        saldoFinalPeriodo: saldoCorrente,
        movimentos,
    });
});
const contaDaEmpresa = async (idConta, idEmpresa) => data_source_1.AppDataSource.getRepository(Conta_1.Conta).findOne({ where: { id_conta: idConta, id_empresa: idEmpresa } });
exports.contasRouter.post("/:id/conciliacao/importar", auth_1.requireAuth, async (req, res) => {
    const schema = zod_1.z.object({ nome: zod_1.z.string().min(1).max(255), conteudo: zod_1.z.string().min(1).max(2 * 1024 * 1024) });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: "Arquivo OFX inválido." });
    const idConta = Number(req.params.id), idEmpresa = req.user.id_empresa;
    if (!(await contaDaEmpresa(idConta, idEmpresa)))
        return res.status(404).json({ error: "Conta não encontrada" });
    let itens;
    try {
        itens = (0, ofx_1.parseOfx)(parse.data.conteudo);
    }
    catch (e) {
        return res.status(400).json({ error: e instanceof Error ? e.message : "OFX inválido" });
    }
    try {
        const resultado = await data_source_1.AppDataSource.transaction(async (manager) => {
            const [imp] = await manager.query(`INSERT INTO conciliacao_importacoes (id_empresa,id_conta,nome_arquivo,hash_arquivo,id_usuario) VALUES ($1,$2,$3,$4,$5) RETURNING id_importacao`, [idEmpresa, idConta, parse.data.nome, (0, ofx_1.hashOfx)(parse.data.conteudo), req.user.id_usuario]);
            let inseridos = 0;
            for (const item of itens) {
                const rows = await manager.query(`INSERT INTO conciliacao_itens (id_importacao,id_empresa,id_conta,fitid,data,tipo,valor,descricao) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id_conta,fitid) DO NOTHING RETURNING id_item`, [imp.id_importacao, idEmpresa, idConta, item.fitid, item.data, item.tipo, item.valor, item.descricao]);
                inseridos += rows.length;
            }
            return { id_importacao: imp.id_importacao, inseridos, duplicados: itens.length - inseridos };
        });
        await AuditoriaService_1.AuditoriaService.registrar(req, "conciliacao_importacoes", "CREATE", resultado.id_importacao, undefined, resultado, `OFX importado — ${parse.data.nome}`);
        return res.status(201).json(resultado);
    }
    catch (e) {
        if (e?.code === "23505")
            return res.status(409).json({ error: "Este arquivo OFX já foi importado para a conta." });
        throw e;
    }
});
exports.contasRouter.get("/:id/conciliacao", auth_1.requireAuth, async (req, res) => {
    const idConta = Number(req.params.id), idEmpresa = req.user.id_empresa;
    if (!(await contaDaEmpresa(idConta, idEmpresa)))
        return res.status(404).json({ error: "Conta não encontrada" });
    const status = ["pendente", "conciliado", "ignorado"].includes(String(req.query.status)) ? String(req.query.status) : "pendente";
    const rows = await data_source_1.AppDataSource.query(`SELECT i.*, v.origem AS vinculo_origem, v.id_origem AS vinculo_id,
    COALESCE((SELECT json_agg(s ORDER BY s.diferenca_dias, s.data) FROM (SELECT mf.origem,mf.id_origem,mf.data,mf.descricao,mf.valor,ABS(mf.data-i.data) AS diferenca_dias FROM movimentos_financeiros mf WHERE mf.id_empresa=i.id_empresa AND mf.id_conta=i.id_conta AND mf.tipo=i.tipo AND mf.valor=i.valor AND mf.data BETWEEN i.data-3 AND i.data+3 AND NOT EXISTS (SELECT 1 FROM conciliacao_vinculos cv WHERE cv.id_conta=i.id_conta AND cv.origem=mf.origem AND cv.id_origem=mf.id_origem) LIMIT 5) s),'[]'::json) AS sugestoes
    FROM conciliacao_itens i LEFT JOIN conciliacao_vinculos v ON v.id_item=i.id_item WHERE i.id_empresa=$1 AND i.id_conta=$2 AND i.status=$3 ORDER BY i.data DESC,i.id_item DESC`, [idEmpresa, idConta, status]);
    return res.json(rows);
});
exports.contasRouter.post("/:id/conciliacao/:item/vincular", auth_1.requireAuth, async (req, res) => {
    const body = zod_1.z.object({ origem: zod_1.z.string().min(1).max(20), id_origem: zod_1.z.number().int().positive() }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: "Movimento inválido" });
    const idConta = Number(req.params.id), idItem = Number(req.params.item), idEmpresa = req.user.id_empresa;
    const [mov] = await data_source_1.AppDataSource.query(`SELECT 1 FROM movimentos_financeiros mf JOIN conciliacao_itens i ON i.id_item=$4 AND i.id_empresa=$1 AND i.id_conta=$2 AND i.status='pendente' WHERE mf.id_empresa=$1 AND mf.id_conta=$2 AND mf.origem=$3 AND mf.id_origem=$5 AND mf.tipo=i.tipo AND mf.valor=i.valor`, [idEmpresa, idConta, body.data.origem, idItem, body.data.id_origem]);
    if (!mov)
        return res.status(400).json({ error: "O movimento não corresponde à conta, tipo e valor do item bancário." });
    const v = await data_source_1.AppDataSource.transaction(async (manager) => {
        const [saved] = await manager.query(`INSERT INTO conciliacao_vinculos (id_item,id_empresa,id_conta,origem,id_origem,id_usuario) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_vinculo`, [idItem, idEmpresa, idConta, body.data.origem, body.data.id_origem, req.user.id_usuario]);
        await manager.query(`UPDATE conciliacao_itens SET status='conciliado' WHERE id_item=$1 AND id_empresa=$2`, [idItem, idEmpresa]);
        return saved;
    });
    await AuditoriaService_1.AuditoriaService.registrar(req, "conciliacao_vinculos", "CREATE", v.id_vinculo, undefined, { id_item: idItem, ...body.data }, "Movimento bancário conciliado");
    return res.status(201).json(v);
});
exports.contasRouter.patch("/:id/conciliacao/:item/status", auth_1.requireAuth, async (req, res) => {
    const parse = zod_1.z.object({ status: zod_1.z.enum(["pendente", "ignorado"]) }).safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: "Status inválido" });
    const rows = await data_source_1.AppDataSource.query(`UPDATE conciliacao_itens SET status=$1 WHERE id_item=$2 AND id_conta=$3 AND id_empresa=$4 AND NOT EXISTS (SELECT 1 FROM conciliacao_vinculos WHERE id_item=$2) RETURNING id_item`, [parse.data.status, Number(req.params.item), Number(req.params.id), req.user.id_empresa]);
    if (!rows.length)
        return res.status(404).json({ error: "Item não encontrado ou já conciliado" });
    return res.json(rows[0]);
});
exports.contasRouter.delete("/:id/conciliacao/:item/vinculo", auth_1.requireAuth, async (req, res) => {
    const idItem = Number(req.params.item), idConta = Number(req.params.id), idEmpresa = req.user.id_empresa;
    const rows = await data_source_1.AppDataSource.transaction(async (manager) => { const deleted = await manager.query(`DELETE FROM conciliacao_vinculos WHERE id_item=$1 AND id_conta=$2 AND id_empresa=$3 RETURNING id_vinculo`, [idItem, idConta, idEmpresa]); if (deleted.length)
        await manager.query(`UPDATE conciliacao_itens SET status='pendente' WHERE id_item=$1`, [idItem]); return deleted; });
    if (!rows.length)
        return res.status(404).json({ error: "Conciliação não encontrada" });
    await AuditoriaService_1.AuditoriaService.registrar(req, "conciliacao_vinculos", "DELETE", rows[0].id_vinculo, { id_item: idItem }, undefined, "Conciliação desfeita");
    return res.status(204).send();
});
// ─── POST / ───────────────────────────────────────────────────────────────────
exports.contasRouter.post("/", auth_1.requireAuth, async (req, res) => {
    const parseResult = contaBodySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const data = parseResult.data;
    const tipo = data.tipo ?? "banco";
    const repo = data_source_1.AppDataSource.getRepository(Conta_1.Conta);
    const conta = repo.create({
        ...data,
        tipo,
        saldo_inicial: String(data.saldo_inicial ?? 0),
        ativo: data.ativo ?? true,
        id_empresa: req.user?.id_empresa ?? 1,
    });
    const saved = await repo.save(conta);
    await AuditoriaService_1.AuditoriaService.registrar(req, "contas", "CREATE", saved.id_conta, undefined, {
        apelido: saved.apelido, tipo: saved.tipo, saldo_inicial: saved.saldo_inicial, data_saldo_inicial: saved.data_saldo_inicial, ativo: saved.ativo,
    }, `Conta financeira criada — ${saved.apelido}`);
    return res.status(201).json(saved);
});
// ─── PUT /:id — editar dados ──────────────────────────────────────────────────
exports.contasRouter.put("/:id", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const parseResult = contaBodySchema.partial().safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Conta_1.Conta);
    const where = { id_conta: Number(id) };
    if (req.user?.id_empresa) {
        where.id_empresa = req.user.id_empresa;
    }
    const conta = await repo.findOne({ where });
    if (!conta) {
        return res.status(404).json({ error: "Conta não encontrada" });
    }
    const valoresAntigos = { apelido: conta.apelido, tipo: conta.tipo, saldo_inicial: conta.saldo_inicial, data_saldo_inicial: conta.data_saldo_inicial, ativo: conta.ativo };
    const { saldo_inicial, ...rest } = parseResult.data;
    Object.assign(conta, rest);
    if (saldo_inicial !== undefined)
        conta.saldo_inicial = String(saldo_inicial);
    const saved = await repo.save(conta);
    await AuditoriaService_1.AuditoriaService.registrar(req, "contas", "UPDATE", saved.id_conta, valoresAntigos, {
        apelido: saved.apelido, tipo: saved.tipo, saldo_inicial: saved.saldo_inicial, data_saldo_inicial: saved.data_saldo_inicial, ativo: saved.ativo,
    }, `Conta financeira editada — ${saved.apelido}`);
    return res.json(saved);
});
// ─── PATCH /:id/ativo — ativar / desativar ────────────────────────────────────
exports.contasRouter.patch("/:id/ativo", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;
    if (typeof ativo !== "boolean") {
        return res.status(400).json({ error: "Campo 'ativo' deve ser boolean" });
    }
    const repo = data_source_1.AppDataSource.getRepository(Conta_1.Conta);
    const where = { id_conta: Number(id) };
    if (req.user?.id_empresa) {
        where.id_empresa = req.user.id_empresa;
    }
    const conta = await repo.findOne({ where });
    if (!conta) {
        return res.status(404).json({ error: "Conta não encontrada" });
    }
    const ativoAnterior = conta.ativo;
    conta.ativo = ativo;
    const saved = await repo.save(conta);
    await AuditoriaService_1.AuditoriaService.registrar(req, "contas", "UPDATE", saved.id_conta, { ativo: ativoAnterior }, { ativo: saved.ativo }, `${saved.ativo ? "Conta ativada" : "Conta desativada"} — ${saved.apelido}`);
    return res.json(saved);
});
// ─── DELETE /:id ──────────────────────────────────────────────────────────────
exports.contasRouter.delete("/:id", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const repo = data_source_1.AppDataSource.getRepository(Conta_1.Conta);
    const where = { id_conta: Number(id) };
    if (req.user?.id_empresa) {
        where.id_empresa = req.user.id_empresa;
    }
    const conta = await repo.findOne({ where });
    if (!conta) {
        return res.status(404).json({ error: "Conta não encontrada" });
    }
    await repo.remove(conta);
    await AuditoriaService_1.AuditoriaService.registrar(req, "contas", "DELETE", Number(id), {
        apelido: conta.apelido, tipo: conta.tipo, saldo_inicial: conta.saldo_inicial, data_saldo_inicial: conta.data_saldo_inicial, ativo: conta.ativo,
    }, undefined, `Conta financeira excluída — ${conta.apelido}`);
    return res.status(204).send();
});
