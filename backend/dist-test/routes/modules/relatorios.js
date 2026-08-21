"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.relatoriosRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const auth_1 = require("../../middleware/auth");
const contas_1 = require("./contas");
const FinanceiroService_1 = require("../../services/FinanceiroService");
exports.relatoriosRouter = (0, express_1.Router)();
exports.relatoriosRouter.use(auth_1.requireAuth, (0, auth_1.requireFeature)("module_relatorios"));
const entradasQuerySchema = zod_1.z.object({
    from: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida")
        .optional(),
    to: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida")
        .optional(),
    id_loteamento: zod_1.z
        .string()
        .regex(/^\d+$/, "Loteamento inválido")
        .transform((value) => parseInt(value, 10))
        .optional(),
});
const entradasContaQuerySchema = zod_1.z.object({
    from: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida")
        .optional(),
    to: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida")
        .optional(),
    id_conta: zod_1.z
        .string()
        .regex(/^\d+$/, "Conta inválida")
        .transform((value) => parseInt(value, 10))
        .optional(),
});
const jurosRecebidosQuerySchema = zod_1.z.object({
    ano: zod_1.z
        .string()
        .regex(/^\d{4}$/, "Ano inválido"),
    id_conta: zod_1.z
        .string()
        .regex(/^\d+$/, "Conta inválida")
        .transform((value) => parseInt(value, 10)),
});
const agingQuerySchema = zod_1.z.object({
    data_referencia: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de referência inválida").optional(),
});
const FAIXAS_AGING = ["0–30", "31–60", "61–90", "+90"];
function completarFaixasAging(rows) {
    const porFaixa = new Map(rows.map((row) => [row.faixa, row]));
    return FAIXAS_AGING.map((faixa) => ({
        faixa,
        quantidade: Number(porFaixa.get(faixa)?.quantidade ?? 0),
        total: Number(porFaixa.get(faixa)?.total ?? 0),
    }));
}
exports.relatoriosRouter.get("/aging", async (req, res) => {
    const parse = agingQuerySchema.safeParse(req.query);
    if (!parse.success)
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parse.error.issues });
    const idEmpresa = req.user.id_empresa;
    const referencia = parse.data.data_referencia ?? null;
    const faixaSql = `CASE WHEN dias <= 30 THEN '0–30' WHEN dias <= 60 THEN '31–60' WHEN dias <= 90 THEN '61–90' ELSE '+90' END`;
    const receberQuery = `WITH titulos AS (
    SELECT (($2::date) - p.vencimento)::int AS dias, p.valor::numeric AS saldo
    FROM pagamentos p JOIN vendas v ON v.id_venda=p.id_venda
    WHERE p.id_empresa=$1 AND p.situacao='aberto' AND v.status<>'cancelada' AND p.vencimento<=$2::date
  ) SELECT ${faixaSql} AS faixa,COUNT(*)::int AS quantidade,COALESCE(SUM(saldo),0)::numeric AS total
    FROM titulos GROUP BY faixa`;
    const pagarQuery = `WITH baixas AS (
      SELECT id_despesa_parcela,SUM(valor_principal+desconto)::numeric AS liquidado
      FROM despesa_parcela_pagamentos WHERE id_empresa=$1 GROUP BY id_despesa_parcela
    ), titulos AS (
      SELECT (($2::date) - p.vencimento)::int AS dias,GREATEST(p.valor-COALESCE(b.liquidado,0),0)::numeric AS saldo
      FROM despesa_parcelas p LEFT JOIN baixas b ON b.id_despesa_parcela=p.id_despesa_parcela
      WHERE p.id_empresa=$1 AND p.situacao<>'pago' AND p.vencimento<=$2::date
    ) SELECT ${faixaSql} AS faixa,COUNT(*) FILTER(WHERE saldo>0)::int AS quantidade,COALESCE(SUM(saldo) FILTER(WHERE saldo>0),0)::numeric AS total
      FROM titulos GROUP BY faixa`;
    const dataRows = referencia ? [{ data_referencia: referencia }] : await data_source_1.AppDataSource.query("SELECT TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') AS data_referencia");
    const dataReferencia = String(dataRows[0].data_referencia);
    const [receberRows, pagarRows] = await Promise.all([
        data_source_1.AppDataSource.query(receberQuery, [idEmpresa, dataReferencia]),
        data_source_1.AppDataSource.query(pagarQuery, [idEmpresa, dataReferencia]),
    ]);
    return res.json({ dataReferencia, receber: completarFaixasAging(receberRows), pagar: completarFaixasAging(pagarRows) });
});
exports.relatoriosRouter.get("/entradas-por-loteamento", auth_1.requireAuth, async (req, res) => {
    const parseResult = entradasQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { from, to, id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }
    const params = [idEmpresa];
    const conditions = [
        "p.situacao = 'pago'",
        "p.pago_data IS NOT NULL",
        "p.id_empresa = $1",
        "v.status <> 'cancelada'",
    ];
    if (from) {
        params.push(from);
        conditions.push(`p.pago_data >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`p.pago_data <= $${params.length}`);
    }
    if (typeof id_loteamento === "number") {
        params.push(id_loteamento);
        conditions.push(`lot.id_loteamento = $${params.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `
      SELECT
        lot.id_loteamento,
        lot.nome AS loteamento,
        EXTRACT(MONTH FROM p.pago_data) AS mes,
        SUM(COALESCE(p.valor_pago, p.valor)) AS total
      FROM pagamentos p
      JOIN vendas v ON v.id_venda = p.id_venda
      JOIN lotes l ON l.id_lote = v.id_lote
      JOIN loteamentos lot ON lot.id_loteamento = l.id_loteamento
      ${whereClause}
      GROUP BY lot.id_loteamento, lot.nome, mes
      ORDER BY lot.nome, mes
    `;
    const rows = await data_source_1.AppDataSource.query(query, params);
    const resultado = [];
    const byLoteamento = {};
    for (const row of rows) {
        const id = Number(row.id_loteamento);
        const mes = Number(row.mes);
        const total = Number(row.total);
        if (!byLoteamento[id]) {
            byLoteamento[id] = {
                id_loteamento: id,
                loteamento: row.loteamento,
                jan: 0,
                fev: 0,
                mar: 0,
                abr: 0,
                mai: 0,
                jun: 0,
                jul: 0,
                ago: 0,
                set: 0,
                out: 0,
                nov: 0,
                dez: 0,
                total: 0,
            };
        }
        if (mes === 1)
            byLoteamento[id].jan += total;
        if (mes === 2)
            byLoteamento[id].fev += total;
        if (mes === 3)
            byLoteamento[id].mar += total;
        if (mes === 4)
            byLoteamento[id].abr += total;
        if (mes === 5)
            byLoteamento[id].mai += total;
        if (mes === 6)
            byLoteamento[id].jun += total;
        if (mes === 7)
            byLoteamento[id].jul += total;
        if (mes === 8)
            byLoteamento[id].ago += total;
        if (mes === 9)
            byLoteamento[id].set += total;
        if (mes === 10)
            byLoteamento[id].out += total;
        if (mes === 11)
            byLoteamento[id].nov += total;
        if (mes === 12)
            byLoteamento[id].dez += total;
        byLoteamento[id].total += total;
    }
    for (const value of Object.values(byLoteamento)) {
        resultado.push(value);
    }
    return res.json(resultado);
});
exports.relatoriosRouter.get("/entradas-por-conta", auth_1.requireAuth, async (req, res) => {
    const parseResult = entradasContaQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { from, to, id_conta } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }
    const params = [idEmpresa];
    const conditions = [
        "p.situacao = 'pago'",
        "p.pago_data IS NOT NULL",
        "p.id_empresa = $1",
        "c.id_empresa = $1",
        "p.id_conta IS NOT NULL",
        "v.status <> 'cancelada'",
    ];
    if (from) {
        params.push(from);
        conditions.push(`p.pago_data >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`p.pago_data <= $${params.length}`);
    }
    if (typeof id_conta === "number") {
        params.push(id_conta);
        conditions.push(`p.id_conta = $${params.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `
      SELECT
        c.id_conta,
        c.apelido,
        c.titular,
        c.agencia,
        c.conta,
        COUNT(*) AS qtd_pagamentos,
        SUM(COALESCE(p.valor_pago, p.valor)) AS total
      FROM pagamentos p
      JOIN contas c ON c.id_conta = p.id_conta
      JOIN vendas v ON v.id_venda = p.id_venda
      ${whereClause}
      GROUP BY c.id_conta, c.apelido, c.titular, c.agencia, c.conta
      ORDER BY c.apelido ASC
    `;
    const rows = await data_source_1.AppDataSource.query(query, params);
    const resultado = rows.map((row) => ({
        id_conta: Number(row.id_conta),
        apelido: row.apelido,
        titular: row.titular,
        agencia: row.agencia,
        conta: row.conta,
        qtdPagamentos: Number(row.qtd_pagamentos ?? 0),
        total: Number(row.total ?? 0),
    }));
    return res.json(resultado);
});
exports.relatoriosRouter.get("/juros-recebidos", auth_1.requireAuth, async (req, res) => {
    const parseResult = jurosRecebidosQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { ano, id_conta } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }
    const query = `
      SELECT
        c.id_conta,
        c.apelido,
        c.titular,
        c.agencia,
        c.conta,
        EXTRACT(MONTH FROM p.pago_data) AS mes,
        SUM(COALESCE(p.juros, 0) + COALESCE(p.multa, 0)) AS total
      FROM pagamentos p
      JOIN contas c ON c.id_conta = p.id_conta
      JOIN vendas v ON v.id_venda = p.id_venda
      WHERE
        p.situacao = 'pago'
        AND p.pago_data IS NOT NULL
        AND p.id_empresa = $1
        AND p.id_conta = $2
        AND EXTRACT(YEAR FROM p.pago_data) = $3::int
        AND v.status <> 'cancelada'
      GROUP BY
        c.id_conta,
        c.apelido,
        c.titular,
        c.agencia,
        c.conta,
        mes
      ORDER BY mes
    `;
    const rows = await data_source_1.AppDataSource.query(query, [idEmpresa, id_conta, ano]);
    if (!rows || rows.length === 0) {
        return res.json({
            id_conta,
            titular: "",
            agencia: "",
            conta: "",
            meses: [],
            totalGeral: 0,
        });
    }
    let totalGeral = 0;
    const meses = rows.map((row) => {
        const total = Number(row.total ?? 0);
        totalGeral += total;
        return {
            mes: Number(row.mes),
            total,
        };
    });
    const first = rows[0];
    return res.json({
        id_conta: Number(first.id_conta),
        titular: first.titular,
        agencia: first.agencia,
        conta: first.conta,
        meses,
        totalGeral,
    });
});
const atrasosQuerySchema = zod_1.z.object({
    from: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida")
        .optional(),
    to: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida")
        .optional(),
    dias_atraso: zod_1.z
        .string()
        .regex(/^\d+$/, "Dias de atraso inválidos")
        .transform((value) => parseInt(value, 10))
        .optional(),
    id_loteamento: zod_1.z
        .string()
        .regex(/^\d+$/, "Loteamento inválido")
        .transform((value) => parseInt(value, 10))
        .optional(),
    cliente: zod_1.z.string().min(1).optional(),
    limit: zod_1.z
        .string()
        .regex(/^\d+$/, "Limite inválido")
        .transform((value) => parseInt(value, 10))
        .optional(),
});
const enderecosCarneQuerySchema = zod_1.z.object({
    id_loteamento: zod_1.z
        .string()
        .regex(/^\d+$/, "Loteamento inválido")
        .transform((value) => parseInt(value, 10))
        .optional(),
});
const clientesPorLoteamentoQuerySchema = enderecosCarneQuerySchema;
exports.relatoriosRouter.get("/titulos-em-atraso", auth_1.requireAuth, async (req, res) => {
    const parseResult = atrasosQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { from, to, dias_atraso, id_loteamento, cliente, limit } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }
    const params = [idEmpresa];
    const conditions = ["p.situacao = 'aberto'", "p.vencimento < CURRENT_DATE", "p.id_empresa = $1", "v.status <> 'cancelada'"];
    if (from) {
        params.push(from);
        conditions.push(`p.vencimento >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`p.vencimento <= $${params.length}`);
    }
    if (typeof dias_atraso === "number") {
        params.push(dias_atraso);
        conditions.push(`GREATEST(0, (CURRENT_DATE - p.vencimento)) >= $${params.length}`);
    }
    if (typeof id_loteamento === "number") {
        params.push(id_loteamento);
        conditions.push(`l.id_loteamento = $${params.length}`);
    }
    if (cliente) {
        params.push(`%${cliente}%`);
        conditions.push(`c.nome ILIKE $${params.length}`);
    }
    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    let query = `
      SELECT
        p.id_pagamento,
        c.nome AS cliente,
        CONCAT('Q.', l.quadra, ' - L.', l.lote) AS lote,
        CONCAT(p.numero_parcela, '/', v.parcelas) AS parcela,
        TO_CHAR(p.vencimento, 'DD/MM/YYYY') AS vencimento,
        p.vencimento,
        p.valor,
        p.multa,
        p.juros,
        GREATEST(0, (CURRENT_DATE - p.vencimento)) AS dias_atraso,
        p.valor + p.multa + p.juros AS total
      FROM pagamentos p
      JOIN vendas v ON v.id_venda = p.id_venda
      JOIN clientes c ON c.id_cliente = v.id_cliente
      JOIN lotes l ON l.id_lote = v.id_lote
      ${whereClause}
      ORDER BY p.vencimento ASC
    `;
    if (typeof limit === "number") {
        params.push(limit);
        query += ` LIMIT $${params.length}`;
    }
    const rows = await data_source_1.AppDataSource.query(query, params);
    const resultado = rows.map((row) => ({
        id_pagamento: Number(row.id_pagamento),
        cliente: row.cliente,
        lote: row.lote,
        parcela: row.parcela,
        vencimento: row.vencimento,
        vencimento_formatado: row.vencimento,
        valor: Number(row.valor),
        multa: Number(row.multa),
        juros: Number(row.juros),
        diasAtraso: Number(row.dias_atraso),
        total: Number(row.total),
    }));
    return res.json(resultado);
});
exports.relatoriosRouter.get("/enderecos-carne", auth_1.requireAuth, async (req, res) => {
    const parseResult = enderecosCarneQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }
    const params = [idEmpresa];
    const conditions = ["v.id_empresa = $1", "v.status <> 'cancelada'"];
    if (typeof id_loteamento === "number") {
        params.push(id_loteamento);
        conditions.push(`lot.id_loteamento = $${params.length}`);
    }
    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const query = `
      SELECT
        c.id_cliente,
        c.nome,
        COALESCE(c.fone_res, c.fone_com) AS telefone,
        c.endereco,
        c.bairro,
        c.cidade,
        c.estado,
        c.cep,
        c.complemento,
        l.quadra,
        l.lote,
        lot.nome AS loteamento
      FROM vendas v
      JOIN clientes c ON c.id_cliente = v.id_cliente
      JOIN lotes l ON l.id_lote = v.id_lote
      JOIN loteamentos lot ON lot.id_loteamento = l.id_loteamento
      ${whereClause}
      ORDER BY c.nome ASC, l.quadra ASC, l.lote ASC
    `;
    const rows = await data_source_1.AppDataSource.query(query, params);
    const resultado = rows.map((row) => ({
        id_cliente: Number(row.id_cliente),
        nome: row.nome,
        telefone: row.telefone ?? "",
        endereco: row.endereco ?? "",
        bairro: row.bairro ?? "",
        cidade: row.cidade ?? "",
        estado: row.estado ?? "",
        cep: row.cep ?? "",
        complemento: row.complemento ?? "",
        quadra: row.quadra !== null ? String(row.quadra) : "",
        lote: row.lote !== null ? String(row.lote) : "",
        loteamento: row.loteamento,
    }));
    return res.json(resultado);
});
exports.relatoriosRouter.get("/clientes-por-loteamento", auth_1.requireAuth, async (req, res) => {
    const parseResult = clientesPorLoteamentoQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }
    const params = [idEmpresa];
    const conditions = ["v.id_empresa = $1", "v.status <> 'cancelada'"];
    if (typeof id_loteamento === "number") {
        params.push(id_loteamento);
        conditions.push(`lot.id_loteamento = $${params.length}`);
    }
    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const query = `
      SELECT
        lot.id_loteamento,
        lot.nome AS loteamento,
        c.id_cliente,
        c.nome AS cliente,
        l.quadra,
        l.lote
      FROM vendas v
      JOIN clientes c ON c.id_cliente = v.id_cliente
      JOIN lotes l ON l.id_lote = v.id_lote
      JOIN loteamentos lot ON lot.id_loteamento = l.id_loteamento
      ${whereClause}
      ORDER BY lot.nome ASC, c.nome ASC, l.quadra ASC, l.lote ASC
    `;
    const rows = await data_source_1.AppDataSource.query(query, params);
    const resultado = rows.map((row) => ({
        id_loteamento: Number(row.id_loteamento),
        loteamento: row.loteamento,
        id_cliente: Number(row.id_cliente),
        cliente: row.cliente,
        quadra: row.quadra !== null ? String(row.quadra) : "",
        lote: row.lote !== null ? String(row.lote) : "",
    }));
    return res.json(resultado);
});
exports.relatoriosRouter.get("/dashboard-kpis", auth_1.requireAuth, async (req, res) => {
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }
    const query = `
      SELECT
        (SELECT COUNT(*) FROM clientes c WHERE c.id_empresa = $1) AS total_clientes,
        (SELECT COUNT(*) FROM vendas v WHERE v.id_empresa = $1 AND v.status = 'aberta') AS vendas_ativas,
        (
          SELECT COALESCE(SUM(COALESCE(p.valor_pago, p.valor)), 0)
          FROM pagamentos p
          JOIN vendas v ON v.id_venda = p.id_venda
          WHERE
            p.id_empresa = $1
            AND p.situacao = 'pago'
            AND v.status <> 'cancelada'
            AND p.pago_data >= date_trunc('month', CURRENT_DATE)
            AND p.pago_data < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')
        ) AS recebido_mes,
        (
          SELECT COUNT(*)
          FROM pagamentos p
          JOIN vendas v ON v.id_venda = p.id_venda
          WHERE p.id_empresa = $1
            AND p.situacao = 'aberto'
            AND v.status <> 'cancelada'
            AND p.vencimento < CURRENT_DATE
        ) AS titulos_atraso_qtd,
        (
          SELECT COALESCE(SUM(p.valor + COALESCE(p.multa, 0) + COALESCE(p.juros, 0)), 0)
          FROM pagamentos p
          JOIN vendas v ON v.id_venda = p.id_venda
          WHERE p.id_empresa = $1
            AND p.situacao = 'aberto'
            AND v.status <> 'cancelada'
            AND p.vencimento < CURRENT_DATE
        ) AS titulos_atraso_valor,
        (
          SELECT COALESCE(SUM(dp.valor_pago), 0)
          FROM despesa_parcelas dp
          WHERE dp.id_empresa = $1
            AND dp.situacao = 'pago'
            AND dp.pago_data >= date_trunc('month', CURRENT_DATE)
            AND dp.pago_data < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')
        ) AS despesas_mes
    `;
    const [rows, resumoMes] = await Promise.all([
        data_source_1.AppDataSource.query(query, [idEmpresa]),
        (0, FinanceiroService_1.resumoFinanceiroMesAtual)(idEmpresa),
    ]);
    if (!rows || rows.length === 0) {
        return res.json({
            totalClientes: 0,
            vendasAtivas: 0,
            recebidoMes: 0,
            titulosAtrasoQtd: 0,
            titulosAtrasoValor: 0,
            despesasMes: 0,
        });
    }
    const row = rows[0];
    return res.json({
        totalClientes: Number(row.total_clientes ?? 0),
        vendasAtivas: Number(row.vendas_ativas ?? 0),
        recebidoMes: resumoMes.receita,
        titulosAtrasoQtd: Number(row.titulos_atraso_qtd ?? 0),
        titulosAtrasoValor: Number(row.titulos_atraso_valor ?? 0),
        despesasMes: resumoMes.despesa,
    });
});
exports.relatoriosRouter.get("/vendas-recentes", auth_1.requireAuth, async (req, res) => {
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }
    const query = `
      SELECT
        v.id_venda,
        c.nome AS cliente,
        CONCAT('Quadra ', l.quadra, ' - Lote ', l.lote) AS lote,
        TO_CHAR(v.data_venda, 'DD/MM/YYYY') AS data_venda,
        v.valor_entrada + COALESCE(SUM(p.valor), 0) AS valor_total
      FROM vendas v
      JOIN clientes c ON c.id_cliente = v.id_cliente
      JOIN lotes l ON l.id_lote = v.id_lote
      LEFT JOIN pagamentos p ON p.id_venda = v.id_venda
      WHERE v.id_empresa = $1
        AND v.status <> 'cancelada'
      GROUP BY v.id_venda, c.nome, l.quadra, l.lote, v.data_venda, v.valor_entrada
      ORDER BY v.data_venda DESC, v.id_venda DESC
      LIMIT 5
    `;
    const rows = await data_source_1.AppDataSource.query(query, [idEmpresa]);
    const resultado = rows.map((row) => ({
        id_venda: Number(row.id_venda),
        cliente: row.cliente,
        lote: row.lote,
        data_venda: row.data_venda,
        valor_total: Number(row.valor_total ?? 0),
    }));
    return res.json(resultado);
});
// ═══════════════════════════════════════════════════════════════════════════
//  Despesas — Resultado por Loteamento, Contas a Pagar, Fluxo de Caixa,
//  Despesas por Categoria
// ═══════════════════════════════════════════════════════════════════════════
const resultadoLoteamentoQuerySchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
    id_loteamento: zod_1.z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
});
exports.relatoriosRouter.get("/resultado-por-loteamento", auth_1.requireAuth, async (req, res) => {
    const parseResult = resultadoLoteamentoQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { from, to, id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const query = `
      WITH alocados AS (
        SELECT mf.id_loteamento, mf.tipo, mf.valor, mf.data
        FROM movimentos_financeiros mf
        WHERE mf.id_empresa = $1 AND mf.id_loteamento IS NOT NULL
          AND (mf.origem = 'recebimento'
            OR (mf.origem = 'manual' AND NOT EXISTS (SELECT 1 FROM lancamento_rateio lr WHERE lr.id_lancamento = mf.id_origem))
            OR (mf.origem = 'pagamento' AND NOT EXISTS (
              SELECT 1 FROM despesa_parcela_pagamentos pp JOIN despesa_parcelas dp ON dp.id_despesa_parcela=pp.id_despesa_parcela JOIN despesa_rateio dr ON dr.id_despesa = dp.id_despesa
              WHERE pp.id_parcela_pagamento = mf.id_origem)))
        UNION ALL
        SELECT lr.id_loteamento, mf.tipo, mf.valor * (lr.percentual / 100.0), mf.data
        FROM movimentos_financeiros mf
        JOIN lancamento_rateio lr ON mf.origem = 'manual' AND lr.id_lancamento = mf.id_origem
        WHERE mf.id_empresa = $1
        UNION ALL
        SELECT dr.id_loteamento, mf.tipo, mf.valor * (dr.percentual / 100.0), mf.data
        FROM movimentos_financeiros mf
        JOIN despesa_parcela_pagamentos pp ON mf.origem = 'pagamento' AND pp.id_parcela_pagamento = mf.id_origem
        JOIN despesa_parcelas dp ON dp.id_despesa_parcela = pp.id_despesa_parcela
        JOIN despesa_rateio dr ON dr.id_despesa = dp.id_despesa
        WHERE mf.id_empresa = $1
      ), totais AS (
        SELECT id_loteamento,
          COALESCE(SUM(valor) FILTER (WHERE tipo = 'receita'), 0) AS receita,
          COALESCE(SUM(valor) FILTER (WHERE tipo = 'despesa'), 0) AS despesas
        FROM alocados
        WHERE ($2::date IS NULL OR data >= $2::date) AND ($3::date IS NULL OR data <= $3::date)
        GROUP BY id_loteamento
      )
      SELECT lot.id_loteamento, lot.nome AS loteamento,
             COALESCE(t.receita, 0) AS receita, COALESCE(t.despesas, 0) AS despesas
      FROM loteamentos lot
      LEFT JOIN totais t ON t.id_loteamento = lot.id_loteamento
      WHERE lot.id_empresa = $1 AND ($4::int IS NULL OR lot.id_loteamento = $4::int)
      ORDER BY lot.nome ASC`;
    const rows = await data_source_1.AppDataSource.query(query, [idEmpresa, from ?? null, to ?? null, id_loteamento ?? null]);
    const resultado = rows.map((row) => {
        const receita = Number(row.receita ?? 0);
        const despesas = Number(row.despesas ?? 0);
        return {
            id_loteamento: Number(row.id_loteamento),
            loteamento: row.loteamento,
            receita,
            despesas,
            resultado: receita - despesas,
        };
    });
    return res.json(resultado);
});
const dividaLoteamentoQuerySchema = zod_1.z.object({
    id_loteamento: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
});
// ─── GET /divida-por-loteamento?id_loteamento=1&id_loteamento=2 — quanto cada
// loteamento tem vendido, pago, atrasado e ainda a vencer (um ou mais loteamentos,
// ou todos se nenhum for informado) ────────────────────────────────────────────
exports.relatoriosRouter.get("/divida-por-loteamento", auth_1.requireAuth, async (req, res) => {
    const parseResult = dividaLoteamentoQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const raw = parseResult.data.id_loteamento;
    const ids = (Array.isArray(raw) ? raw : raw ? [raw] : [])
        .map((v) => parseInt(v, 10))
        .filter((n) => Number.isInteger(n) && n > 0);
    const params = [idEmpresa];
    let loteamentoFilter = "";
    if (ids.length > 0) {
        params.push(ids);
        loteamentoFilter = `AND lo.id_loteamento = ANY($${params.length}::int[])`;
    }
    const rows = await data_source_1.AppDataSource.query(`
      SELECT
        lo.id_loteamento,
        lo.nome,
        lo.cidade,
        lo.estado,
        COALESCE(SUM(p.valor), 0) AS total_vendido,
        COALESCE(SUM(CASE WHEN p.situacao = 'pago' THEN COALESCE(p.valor_pago, p.valor) ELSE 0 END), 0) AS total_pago,
        COALESCE(SUM(CASE WHEN p.situacao = 'aberto' AND p.vencimento < CURRENT_DATE THEN p.valor ELSE 0 END), 0) AS total_atrasado,
        COALESCE(SUM(CASE WHEN p.situacao = 'aberto' AND p.vencimento >= CURRENT_DATE THEN p.valor ELSE 0 END), 0) AS total_a_vencer,
        COUNT(*) FILTER (WHERE p.situacao = 'aberto' AND p.vencimento < CURRENT_DATE) AS qtd_atrasadas,
        COUNT(*) FILTER (WHERE p.situacao = 'aberto' AND p.vencimento >= CURRENT_DATE) AS qtd_a_vencer,
        COUNT(DISTINCT v.id_venda) AS qtd_vendas
      FROM loteamentos lo
      LEFT JOIN lotes l ON l.id_loteamento = lo.id_loteamento
      LEFT JOIN vendas v ON v.id_lote = l.id_lote AND v.status <> 'cancelada'
      LEFT JOIN pagamentos p ON p.id_venda = v.id_venda
      WHERE lo.id_empresa = $1 ${loteamentoFilter}
      GROUP BY lo.id_loteamento, lo.nome, lo.cidade, lo.estado
      ORDER BY lo.nome ASC
      `, params);
    const resultado = rows.map((r) => {
        const totalVendido = Number(r.total_vendido ?? 0);
        const totalPago = Number(r.total_pago ?? 0);
        return {
            id_loteamento: Number(r.id_loteamento),
            nome: r.nome,
            cidade: r.cidade,
            estado: r.estado,
            totalVendido,
            totalPago,
            totalAtrasado: Number(r.total_atrasado ?? 0),
            totalAVencer: Number(r.total_a_vencer ?? 0),
            qtdParcelasAtrasadas: Number(r.qtd_atrasadas ?? 0),
            qtdParcelasAVencer: Number(r.qtd_a_vencer ?? 0),
            qtdVendas: Number(r.qtd_vendas ?? 0),
            percentualPago: totalVendido > 0 ? (totalPago / totalVendido) * 100 : 0,
        };
    });
    return res.json(resultado);
});
// ─── GET /lotes-por-loteamento — total de lotes, disponíveis e vendidos por
// loteamento (um lote conta como vendido se tem venda não cancelada) ──────────
exports.relatoriosRouter.get("/lotes-por-loteamento", auth_1.requireAuth, async (req, res) => {
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const rows = await data_source_1.AppDataSource.query(`
      SELECT
        lo.id_loteamento,
        lo.nome,
        lo.cidade,
        lo.estado,
        COUNT(l.id_lote) AS total_lotes,
        COUNT(l.id_lote) FILTER (WHERE v.id_venda IS NOT NULL) AS vendidos,
        COUNT(l.id_lote) FILTER (WHERE v.id_venda IS NULL) AS disponiveis
      FROM loteamentos lo
      LEFT JOIN lotes l ON l.id_loteamento = lo.id_loteamento
      LEFT JOIN LATERAL (
        SELECT v.id_venda FROM vendas v
        WHERE v.id_lote = l.id_lote AND v.status <> 'cancelada'
        LIMIT 1
      ) v ON TRUE
      WHERE lo.id_empresa = $1
      GROUP BY lo.id_loteamento, lo.nome, lo.cidade, lo.estado
      ORDER BY lo.nome ASC
      `, [idEmpresa]);
    const resultado = rows.map((r) => {
        const total = Number(r.total_lotes ?? 0);
        const vendidos = Number(r.vendidos ?? 0);
        return {
            id_loteamento: Number(r.id_loteamento),
            nome: r.nome,
            cidade: r.cidade,
            estado: r.estado,
            totalLotes: total,
            vendidos,
            disponiveis: Number(r.disponiveis ?? 0),
            percentualVendido: total > 0 ? (vendidos / total) * 100 : 0,
        };
    });
    return res.json(resultado);
});
const despesasEmAbertoQuerySchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
    id_loteamento: zod_1.z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
    apenas_atraso: zod_1.z.enum(["true", "false"]).optional(),
});
exports.relatoriosRouter.get("/despesas-em-aberto", auth_1.requireAuth, async (req, res) => {
    const parseResult = despesasEmAbertoQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { from, to, id_loteamento, apenas_atraso } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const params = [idEmpresa];
    const conditions = ["dp.situacao = 'aberto'", "dp.id_empresa = $1"];
    if (from) {
        params.push(from);
        conditions.push(`dp.vencimento >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`dp.vencimento <= $${params.length}`);
    }
    if (typeof id_loteamento === "number") {
        params.push(id_loteamento);
        conditions.push(`d.id_loteamento = $${params.length}`);
    }
    if (apenas_atraso === "true") {
        conditions.push("dp.vencimento < CURRENT_DATE");
    }
    const query = `
      SELECT
        dp.id_despesa_parcela,
        d.descricao,
        COALESCE(lo.nome, 'Administrativa') AS loteamento,
        cat.nome AS categoria,
        forn.nome AS fornecedor,
        CONCAT(dp.numero_parcela, '/', d.numero_parcelas) AS parcela,
        TO_CHAR(dp.vencimento, 'DD/MM/YYYY') AS vencimento,
        dp.valor,
        GREATEST(0, (CURRENT_DATE - dp.vencimento)) AS dias_atraso
      FROM despesa_parcelas dp
      JOIN despesas d ON d.id_despesa = dp.id_despesa
      LEFT JOIN loteamentos lo ON lo.id_loteamento = d.id_loteamento
      LEFT JOIN plano_de_contas cat ON cat.id_conta_contabil = d.id_categoria
      LEFT JOIN fornecedores forn ON forn.id_fornecedor = d.id_fornecedor
      WHERE ${conditions.join(" AND ")}
      ORDER BY dp.vencimento ASC
    `;
    const rows = await data_source_1.AppDataSource.query(query, params);
    const resultado = rows.map((row) => ({
        id_despesa_parcela: Number(row.id_despesa_parcela),
        descricao: row.descricao,
        loteamento: row.loteamento,
        categoria: row.categoria ?? "—",
        fornecedor: row.fornecedor ?? "—",
        parcela: row.parcela,
        vencimento: row.vencimento,
        valor: Number(row.valor),
        diasAtraso: Number(row.dias_atraso),
    }));
    return res.json(resultado);
});
const fluxoCaixaQuerySchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
});
exports.relatoriosRouter.get("/fluxo-de-caixa", auth_1.requireAuth, async (req, res) => {
    const parseResult = fluxoCaixaQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const hoje = new Date();
    const from = parseResult.data.from ?? new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1).toISOString().slice(0, 10);
    const to = parseResult.data.to ?? hoje.toISOString().slice(0, 10);
    const resultado = (await (0, FinanceiroService_1.fluxoFinanceiroMensal)(idEmpresa, from, to)).map((item) => ({
        mes: item.mes,
        entradas: item.receita,
        saidas: item.despesa,
        saldo: item.resultado,
    }));
    return res.json(resultado);
});
const fluxoCaixaFuturoQuerySchema = zod_1.z.object({
    mes: zod_1.z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido (use YYYY-MM)").optional(),
});
// ─── GET /fluxo-de-caixa-futuro?mes=YYYY-MM — projeção de caixa do mês: saldo
// inicial (real, hoje, projetado até o início do mês selecionado), o que tem a
// pagar/receber dia a dia, saldo projetado por dia e alertas de risco de caixa ─
exports.relatoriosRouter.get("/fluxo-de-caixa-futuro", auth_1.requireAuth, async (req, res) => {
    const parseResult = fluxoCaixaFuturoQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const hoje = new Date();
    const mesParam = parseResult.data.mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const [anoSel, mesSel] = mesParam.split("-").map(Number);
    const inicioMes = new Date(anoSel, mesSel - 1, 1).toISOString().slice(0, 10);
    const fimMes = new Date(anoSel, mesSel, 0).toISOString().slice(0, 10);
    const hojeIso = hoje.toISOString().slice(0, 10);
    const saldoHoje = await (0, contas_1.saldoAtualGeralEmpresa)(idEmpresa);
    // Se o mês selecionado é futuro, soma o que está previsto (aberto) para
    // acontecer entre hoje e o início do mês, assumindo que será pago/recebido
    // na data de vencimento. Para o mês atual (ou passado) esse intervalo é vazio.
    let ajustePreMes = 0;
    if (inicioMes > hojeIso) {
        const rows = await data_source_1.AppDataSource.query(`
        SELECT
          COALESCE((
            SELECT SUM(p.valor) FROM pagamentos p
            JOIN vendas v ON v.id_venda = p.id_venda
            WHERE p.id_empresa = $1 AND p.situacao = 'aberto' AND v.status <> 'cancelada'
              AND p.vencimento >= $2 AND p.vencimento < $3
          ), 0)
          - COALESCE((
            SELECT SUM(dp.valor) FROM despesa_parcelas dp
            WHERE dp.id_empresa = $1 AND dp.situacao = 'aberto'
              AND dp.vencimento >= $2 AND dp.vencimento < $3
          ), 0) AS ajuste
        `, [idEmpresa, hojeIso, inicioMes]);
        ajustePreMes = Number(rows[0]?.ajuste ?? 0);
    }
    const saldoInicialPeriodo = saldoHoje + ajustePreMes;
    const [aPagarRows, aReceberRows] = await Promise.all([
        data_source_1.AppDataSource.query(`
        SELECT TO_CHAR(dp.vencimento, 'YYYY-MM-DD') AS data, d.descricao AS descricao, dp.valor AS valor, f.nome AS terceiro
        FROM despesa_parcelas dp
        JOIN despesas d ON d.id_despesa = dp.id_despesa
        LEFT JOIN fornecedores f ON f.id_fornecedor = d.id_fornecedor
        WHERE dp.id_empresa = $1 AND dp.situacao = 'aberto'
          AND dp.vencimento >= $2 AND dp.vencimento <= $3
        ORDER BY dp.vencimento ASC
        `, [idEmpresa, inicioMes, fimMes]),
        data_source_1.AppDataSource.query(`
        SELECT TO_CHAR(p.vencimento, 'YYYY-MM-DD') AS data,
               CONCAT('Venda #', v.id_venda, ' — parcela ', p.numero_parcela) AS descricao,
               p.valor AS valor, cli.nome AS terceiro
        FROM pagamentos p
        JOIN vendas v ON v.id_venda = p.id_venda
        JOIN clientes cli ON cli.id_cliente = v.id_cliente
        WHERE p.id_empresa = $1 AND p.situacao = 'aberto' AND v.status <> 'cancelada'
          AND p.vencimento >= $2 AND p.vencimento <= $3
        ORDER BY p.vencimento ASC
        `, [idEmpresa, inicioMes, fimMes]),
    ]);
    const totalAPagar = aPagarRows.reduce((acc, r) => acc + Number(r.valor), 0);
    const totalAReceber = aReceberRows.reduce((acc, r) => acc + Number(r.valor), 0);
    const qtdDias = Number(fimMes.slice(-2));
    const itensPagarPorDia = new Map();
    for (const r of aPagarRows) {
        const lista = itensPagarPorDia.get(r.data) ?? [];
        lista.push(r);
        itensPagarPorDia.set(r.data, lista);
    }
    const itensReceberPorDia = new Map();
    for (const r of aReceberRows) {
        const lista = itensReceberPorDia.get(r.data) ?? [];
        lista.push(r);
        itensReceberPorDia.set(r.data, lista);
    }
    let saldoCorrente = saldoInicialPeriodo;
    const dias = [];
    for (let dia = 1; dia <= qtdDias; dia++) {
        const dataIso = `${inicioMes.slice(0, 8)}${String(dia).padStart(2, "0")}`;
        const itensPagar = itensPagarPorDia.get(dataIso) ?? [];
        const itensReceber = itensReceberPorDia.get(dataIso) ?? [];
        const aPagar = itensPagar.reduce((acc, r) => acc + Number(r.valor), 0);
        const aReceber = itensReceber.reduce((acc, r) => acc + Number(r.valor), 0);
        saldoCorrente += aReceber - aPagar;
        dias.push({
            data: dataIso,
            aPagar,
            aReceber,
            resultadoDia: aReceber - aPagar,
            saldoDia: saldoCorrente,
            itensPagar: itensPagar.map((r) => ({ descricao: r.descricao, valor: Number(r.valor), terceiro: r.terceiro })),
            itensReceber: itensReceber.map((r) => ({ descricao: r.descricao, valor: Number(r.valor), terceiro: r.terceiro })),
        });
    }
    const saldoFinalProjetado = saldoCorrente;
    const diasNegativos = dias.filter((d) => d.saldoDia < 0).map((d) => d.data);
    const melhorDia = dias.reduce((melhor, d) => (d.saldoDia > melhor.saldoDia ? d : melhor), dias[0] ?? null);
    return res.json({
        mes: mesParam,
        saldoInicialPeriodo,
        totalAPagar,
        totalAReceber,
        saldoFinalProjetado,
        dias,
        diasNegativos,
        melhorDiaPagamento: melhorDia?.data ?? null,
        melhorDiaSaldo: melhorDia?.saldoDia ?? null,
    });
});
// ─── GET /fluxo-de-caixa-previsto — previsão mensal (próximos 12 meses) de
// entradas (parcelas de venda em aberto), saídas (contas a pagar em aberto) e
// saldo projetado das contas, partindo do saldo real de hoje ──────────────────
exports.relatoriosRouter.get("/fluxo-de-caixa-previsto", auth_1.requireAuth, async (req, res) => {
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 0).toISOString().slice(0, 10);
    const [saldoHoje, saidasRows, entradasRows] = await Promise.all([
        (0, contas_1.saldoAtualGeralEmpresa)(idEmpresa),
        data_source_1.AppDataSource.query(`SELECT TO_CHAR(dp.vencimento, 'YYYY-MM') AS mes, SUM(dp.valor) AS total
         FROM despesa_parcelas dp
         WHERE dp.id_empresa = $1 AND dp.situacao = 'aberto'
           AND dp.vencimento >= $2 AND dp.vencimento <= $3
         GROUP BY mes ORDER BY mes`, [idEmpresa, inicioMes, fimPeriodo]),
        data_source_1.AppDataSource.query(`SELECT TO_CHAR(p.vencimento, 'YYYY-MM') AS mes, SUM(p.valor) AS total
         FROM pagamentos p
         JOIN vendas v ON v.id_venda = p.id_venda
         WHERE p.id_empresa = $1 AND p.situacao = 'aberto' AND v.status <> 'cancelada'
           AND p.vencimento >= $2 AND p.vencimento <= $3
         GROUP BY mes ORDER BY mes`, [idEmpresa, inicioMes, fimPeriodo]),
    ]);
    const saidasMap = new Map(saidasRows.map((r) => [r.mes, Number(r.total ?? 0)]));
    const entradasMap = new Map(entradasRows.map((r) => [r.mes, Number(r.total ?? 0)]));
    let saldoCorrente = saldoHoje;
    const meses = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const entradas = entradasMap.get(chave) ?? 0;
        const saidas = saidasMap.get(chave) ?? 0;
        saldoCorrente += entradas - saidas;
        meses.push({ mes: chave, entradas, saidas, saldo: saldoCorrente });
    }
    return res.json(meses);
});
const despesasPorCategoriaQuerySchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
    id_loteamento: zod_1.z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
});
exports.relatoriosRouter.get("/despesas-por-categoria", auth_1.requireAuth, async (req, res) => {
    const parseResult = despesasPorCategoriaQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { from, to, id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const params = [idEmpresa];
    const conditions = ["dp.id_empresa = $1"];
    if (from) {
        params.push(from);
        conditions.push(`d.created_at::date >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`d.created_at::date <= $${params.length}`);
    }
    if (typeof id_loteamento === "number") {
        params.push(id_loteamento);
        conditions.push(`d.id_loteamento = $${params.length}`);
    }
    const query = `
      SELECT
        cat.id_conta_contabil AS id_categoria,
        cat.nome AS categoria,
        COALESCE(cg.nome, cat.nome) AS grupo,
        COUNT(DISTINCT d.id_despesa) AS qtd_despesas,
        SUM(dp.valor) AS valor_total,
        SUM(dp.valor) FILTER (WHERE dp.situacao = 'pago') AS valor_pago
      FROM despesa_parcelas dp
      JOIN despesas d ON d.id_despesa = dp.id_despesa
      JOIN plano_de_contas cat ON cat.id_conta_contabil = d.id_categoria
      LEFT JOIN plano_de_contas cg ON cg.id_conta_contabil = cat.id_pai
      WHERE ${conditions.join(" AND ")}
      GROUP BY cat.id_conta_contabil, cat.nome, cg.nome
      ORDER BY valor_total DESC
    `;
    const rows = await data_source_1.AppDataSource.query(query, params);
    const resultado = rows.map((row) => ({
        id_categoria: Number(row.id_categoria),
        categoria: row.categoria,
        grupo: row.grupo ?? "—",
        qtdDespesas: Number(row.qtd_despesas ?? 0),
        valorTotal: Number(row.valor_total ?? 0),
        valorPago: Number(row.valor_pago ?? 0),
    }));
    return res.json(resultado);
});
// ═══════════════════════════════════════════════════════════════════════════
//  DRE Mensal — geral ou por loteamento
// ═══════════════════════════════════════════════════════════════════════════
const dreMensalQuerySchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
    id_loteamento: zod_1.z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
});
const LANCAMENTOS_GRUPO_LABEL = "Lançamentos Manuais";
exports.relatoriosRouter.get("/dre-mensal", auth_1.requireAuth, async (req, res) => {
    const parseResult = dreMensalQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa)
        return res.status(400).json({ error: "Empresa não definida para o usuário" });
    const hoje = new Date();
    const from = parseResult.data.from ?? new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1).toISOString().slice(0, 10);
    const to = parseResult.data.to ?? hoje.toISOString().slice(0, 10);
    // Resolve, para qualquer conta do plano, o nome da conta raiz (grupo) subindo a árvore.
    const raizCte = `
      WITH RECURSIVE ancestro AS (
        SELECT id_conta_contabil AS origem, id_conta_contabil AS atual, id_pai, nome
        FROM plano_de_contas WHERE id_empresa = $1
        UNION ALL
        SELECT a.origem, pc.id_conta_contabil, pc.id_pai, pc.nome
        FROM ancestro a JOIN plano_de_contas pc ON pc.id_conta_contabil = a.id_pai
      )
    `;
    const raizSubquery = `(SELECT origem AS id_conta_contabil, nome AS raiz_nome FROM ancestro WHERE id_pai IS NULL)`;
    const receitaVendasQuery = typeof id_loteamento === "number"
        ? `SELECT TO_CHAR(m.data, 'YYYY-MM') AS mes, 'Vendas de Lotes' AS grupo, SUM(m.valor) AS total
         FROM movimentos_financeiros m
         WHERE m.tipo = 'receita' AND m.origem = 'recebimento' AND m.id_empresa = $1 AND m.id_loteamento = $2
           AND m.data >= $3 AND m.data <= $4
         GROUP BY mes`
        : `SELECT TO_CHAR(m.data, 'YYYY-MM') AS mes, 'Vendas de Lotes' AS grupo, SUM(m.valor) AS total
         FROM movimentos_financeiros m
         WHERE m.tipo = 'receita' AND m.origem = 'recebimento' AND m.id_empresa = $1
           AND m.data >= $2 AND m.data <= $3
         GROUP BY mes`;
    const semLoteamentoParams = [idEmpresa, from, to];
    const comLoteamentoParams = [idEmpresa, id_loteamento, from, to];
    const receitaVendasParams = typeof id_loteamento === "number" ? comLoteamentoParams : semLoteamentoParams;
    const lancPorGrupoQuery = (tipo, fallback) => {
        const filtroLoteamento = typeof id_loteamento === "number" ? "AND l.id_loteamento = $2" : "";
        const dataParams = typeof id_loteamento === "number" ? "$3 AND l.data <= $4" : "$2 AND l.data <= $3";
        return `${raizCte}
        SELECT TO_CHAR(l.data, 'YYYY-MM') AS mes, COALESCE(rz.raiz_nome, '${fallback}') AS grupo, SUM(l.valor) AS total
        FROM movimentos_financeiros l
        LEFT JOIN ${raizSubquery} rz ON rz.id_conta_contabil = l.id_conta_contabil
        WHERE l.tipo = '${tipo}' AND l.origem = 'manual' AND l.id_empresa = $1 ${filtroLoteamento} AND l.data >= ${dataParams}
        GROUP BY mes, grupo`;
    };
    const lancParams = typeof id_loteamento === "number" ? comLoteamentoParams : semLoteamentoParams;
    const despesasPorGrupoQuery = `${raizCte}
      SELECT TO_CHAR(dp.data, 'YYYY-MM') AS mes, COALESCE(rz.raiz_nome, 'Outras') AS grupo, SUM(dp.valor) AS total
      FROM movimentos_financeiros dp
      LEFT JOIN ${raizSubquery} rz ON rz.id_conta_contabil = dp.id_conta_contabil
      WHERE dp.tipo = 'despesa' AND dp.origem = 'pagamento' AND dp.id_empresa = $1 ${typeof id_loteamento === "number" ? "AND dp.id_loteamento = $2" : ""}
        AND dp.data >= ${typeof id_loteamento === "number" ? "$3 AND dp.data <= $4" : "$2 AND dp.data <= $3"}
      GROUP BY mes, grupo`;
    const [receitaVendasRows, lancReceitaRows, lancDespesaRows, despesasGrupoRows] = await Promise.all([
        data_source_1.AppDataSource.query(receitaVendasQuery, receitaVendasParams),
        data_source_1.AppDataSource.query(lancPorGrupoQuery("receita", "Outras receitas"), lancParams),
        data_source_1.AppDataSource.query(lancPorGrupoQuery("despesa", LANCAMENTOS_GRUPO_LABEL), lancParams),
        data_source_1.AppDataSource.query(despesasPorGrupoQuery, receitaVendasParams),
    ]);
    const porMes = new Map();
    function getMes(mes) {
        let m = porMes.get(mes);
        if (!m) {
            m = { mes, receita: 0, receitaPorGrupo: {}, despesasPorGrupo: {}, despesasTotal: 0, resultado: 0 };
            porMes.set(mes, m);
        }
        return m;
    }
    for (const r of [...receitaVendasRows, ...lancReceitaRows]) {
        const m = getMes(r.mes);
        const valor = Number(r.total ?? 0);
        m.receitaPorGrupo[r.grupo] = (m.receitaPorGrupo[r.grupo] ?? 0) + valor;
        m.receita += valor;
    }
    for (const r of [...despesasGrupoRows, ...lancDespesaRows]) {
        const m = getMes(r.mes);
        const valor = Number(r.total ?? 0);
        m.despesasPorGrupo[r.grupo] = (m.despesasPorGrupo[r.grupo] ?? 0) + valor;
        m.despesasTotal += valor;
    }
    const resultado = Array.from(porMes.values())
        .map((m) => ({ ...m, resultado: m.receita - m.despesasTotal }))
        .sort((a, b) => a.mes.localeCompare(b.mes));
    return res.json(resultado);
});
