import { Request, Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { AuthRequest, requireAuth, requireFeature } from "../../middleware/auth";
import { saldoAtualGeralEmpresa } from "./contas";
import { fluxoFinanceiroMensal, resumoFinanceiroMesAtual } from "../../services/FinanceiroService";

export const relatoriosRouter = Router();
relatoriosRouter.use(requireAuth, requireFeature("module_relatorios"));

const entradasQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida")
    .optional(),
  id_loteamento: z
    .string()
    .regex(/^\d+$/, "Loteamento inválido")
    .transform((value) => parseInt(value, 10))
    .optional(),
});

const entradasContaQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida")
    .optional(),
  id_conta: z
    .string()
    .regex(/^\d+$/, "Conta inválida")
    .transform((value) => parseInt(value, 10))
    .optional(),
});

const jurosRecebidosQuerySchema = z.object({
  ano: z
    .string()
    .regex(/^\d{4}$/, "Ano inválido"),
  id_conta: z
    .string()
    .regex(/^\d+$/, "Conta inválida")
    .transform((value) => parseInt(value, 10)),
});

relatoriosRouter.get(
  "/entradas-por-loteamento",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = entradasQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }

    const { from, to, id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;

    if (!idEmpresa) {
      return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }

    const params: unknown[] = [idEmpresa];

    const conditions: string[] = [
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

    const rows = await AppDataSource.query(query, params);

    type EntradasRow = {
      id_loteamento: number;
      loteamento: string;
      mes: number;
      total: number;
    };

    type EntradasAggregated = {
      id_loteamento: number;
      loteamento: string;
      jan: number;
      fev: number;
      mar: number;
      abr: number;
      mai: number;
      jun: number;
      jul: number;
      ago: number;
      set: number;
      out: number;
      nov: number;
      dez: number;
      total: number;
    };

    const resultado: EntradasAggregated[] = [];

    const byLoteamento: Record<number, EntradasAggregated> = {};

    for (const row of rows as EntradasRow[]) {
      const id = Number(row.id_loteamento);
      const mes = Number(row.mes);
      const total = Number((row as EntradasRow).total);

      if (!byLoteamento[id]) {
        byLoteamento[id] = {
          id_loteamento: id,
          loteamento: row.loteamento as string,
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

      if (mes === 1) byLoteamento[id].jan += total;
      if (mes === 2) byLoteamento[id].fev += total;
      if (mes === 3) byLoteamento[id].mar += total;
      if (mes === 4) byLoteamento[id].abr += total;
       if (mes === 5) byLoteamento[id].mai += total;
       if (mes === 6) byLoteamento[id].jun += total;
       if (mes === 7) byLoteamento[id].jul += total;
       if (mes === 8) byLoteamento[id].ago += total;
       if (mes === 9) byLoteamento[id].set += total;
       if (mes === 10) byLoteamento[id].out += total;
       if (mes === 11) byLoteamento[id].nov += total;
       if (mes === 12) byLoteamento[id].dez += total;
      byLoteamento[id].total += total;
    }

    for (const value of Object.values(byLoteamento)) {
      resultado.push(value);
    }

    return res.json(resultado);
  },
);

relatoriosRouter.get(
  "/entradas-por-conta",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = entradasContaQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }

    const { from, to, id_conta } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;

    if (!idEmpresa) {
      return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }

    const params: unknown[] = [idEmpresa];

    const conditions: string[] = [
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

    const rows = await AppDataSource.query(query, params);

    type EntradasContaRow = {
      id_conta: number | string;
      apelido: string;
      titular: string;
      agencia: string;
      conta: string;
      qtd_pagamentos: number | string;
      total: number | string | null;
    };

    const resultado = (rows as EntradasContaRow[]).map((row) => ({
      id_conta: Number(row.id_conta),
      apelido: row.apelido,
      titular: row.titular,
      agencia: row.agencia,
      conta: row.conta,
      qtdPagamentos: Number(row.qtd_pagamentos ?? 0),
      total: Number(row.total ?? 0),
    }));

    return res.json(resultado);
  },
);

relatoriosRouter.get(
  "/juros-recebidos",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
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

    const rows = await AppDataSource.query(query, [idEmpresa, id_conta, ano]);

    type JurosRow = {
      id_conta: number | string;
      apelido: string;
      titular: string;
      agencia: string;
      conta: string;
      mes: number | string;
      total: number | string | null;
    };

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

    const meses = (rows as JurosRow[]).map((row) => {
      const total = Number(row.total ?? 0);
      totalGeral += total;

      return {
        mes: Number(row.mes),
        total,
      };
    });

    const first = rows[0] as JurosRow;

    return res.json({
      id_conta: Number(first.id_conta),
      titular: first.titular,
      agencia: first.agencia,
      conta: first.conta,
      meses,
      totalGeral,
    });
  },
);

const atrasosQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida")
    .optional(),
  dias_atraso: z
    .string()
    .regex(/^\d+$/, "Dias de atraso inválidos")
    .transform((value) => parseInt(value, 10))
    .optional(),
  id_loteamento: z
    .string()
    .regex(/^\d+$/, "Loteamento inválido")
    .transform((value) => parseInt(value, 10))
    .optional(),
  cliente: z.string().min(1).optional(),
  limit: z
    .string()
    .regex(/^\d+$/, "Limite inválido")
    .transform((value) => parseInt(value, 10))
    .optional(),
});

const enderecosCarneQuerySchema = z.object({
  id_loteamento: z
    .string()
    .regex(/^\d+$/, "Loteamento inválido")
    .transform((value) => parseInt(value, 10))
    .optional(),
});

const clientesPorLoteamentoQuerySchema = enderecosCarneQuerySchema;

relatoriosRouter.get(
  "/titulos-em-atraso",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = atrasosQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }

    const { from, to, dias_atraso, id_loteamento, cliente, limit } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;

    if (!idEmpresa) {
      return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }

    const params: unknown[] = [idEmpresa];

    const conditions: string[] = ["p.situacao = 'aberto'", "p.vencimento < CURRENT_DATE", "p.id_empresa = $1", "v.status <> 'cancelada'"];

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

    const rows = await AppDataSource.query(query, params);

    type AtrasoRow = {
      id_pagamento: number;
      cliente: string;
      lote: string;
      parcela: string;
      vencimento: string;
      vencimento_formatado?: string;
      valor: string | number;
      multa: string | number;
      juros: string | number;
      dias_atraso: number | string;
      total: string | number;
    };

    const resultado = (rows as AtrasoRow[]).map((row) => ({
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
  },
);

relatoriosRouter.get(
  "/enderecos-carne",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = enderecosCarneQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }

    const { id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;

    if (!idEmpresa) {
      return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }

    const params: unknown[] = [idEmpresa];

    const conditions: string[] = ["v.id_empresa = $1", "v.status <> 'cancelada'"];

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

    const rows = await AppDataSource.query(query, params);

    type EnderecoRow = {
      id_cliente: number | string;
      nome: string;
      telefone: string | null;
      endereco: string | null;
      bairro: string | null;
      cidade: string | null;
      estado: string | null;
      cep: string | null;
      complemento: string | null;
      quadra: string | number | null;
      lote: string | number | null;
      loteamento: string;
    };

    const resultado = (rows as EnderecoRow[]).map((row) => ({
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
  },
);

relatoriosRouter.get(
  "/clientes-por-loteamento",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = clientesPorLoteamentoQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }

    const { id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;

    if (!idEmpresa) {
      return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }

    const params: unknown[] = [idEmpresa];

    const conditions: string[] = ["v.id_empresa = $1", "v.status <> 'cancelada'"];

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

    const rows = await AppDataSource.query(query, params);

    type ClienteLoteRow = {
      id_loteamento: number | string;
      loteamento: string;
      id_cliente: number | string;
      cliente: string;
      quadra: string | number | null;
      lote: string | number | null;
    };

    const resultado = (rows as ClienteLoteRow[]).map((row) => ({
      id_loteamento: Number(row.id_loteamento),
      loteamento: row.loteamento,
      id_cliente: Number(row.id_cliente),
      cliente: row.cliente,
      quadra: row.quadra !== null ? String(row.quadra) : "",
      lote: row.lote !== null ? String(row.lote) : "",
    }));

    return res.json(resultado);
  },
);

relatoriosRouter.get(
  "/dashboard-kpis",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
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
      AppDataSource.query(query, [idEmpresa]),
      resumoFinanceiroMesAtual(idEmpresa),
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

    type DashboardRow = {
      total_clientes: string | number;
      vendas_ativas: string | number;
      recebido_mes: string | number | null;
      titulos_atraso_qtd: string | number | null;
      titulos_atraso_valor: string | number | null;
      despesas_mes: string | number | null;
    };

    const row = rows[0] as DashboardRow;

    return res.json({
      totalClientes: Number(row.total_clientes ?? 0),
      vendasAtivas: Number(row.vendas_ativas ?? 0),
      recebidoMes: resumoMes.receita,
      titulosAtrasoQtd: Number(row.titulos_atraso_qtd ?? 0),
      titulosAtrasoValor: Number(row.titulos_atraso_valor ?? 0),
      despesasMes: resumoMes.despesa,
    });
  },
);

relatoriosRouter.get(
  "/vendas-recentes",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
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

    const rows = await AppDataSource.query(query, [idEmpresa]);

    type VendaRecenteRow = {
      id_venda: number | string;
      cliente: string;
      lote: string;
      data_venda: string;
      valor_total: number | string | null;
    };

    const resultado = (rows as VendaRecenteRow[]).map((row) => ({
      id_venda: Number(row.id_venda),
      cliente: row.cliente,
      lote: row.lote,
      data_venda: row.data_venda,
      valor_total: Number(row.valor_total ?? 0),
    }));

    return res.json(resultado);
  },
);

// ═══════════════════════════════════════════════════════════════════════════
//  Despesas — Resultado por Loteamento, Contas a Pagar, Fluxo de Caixa,
//  Despesas por Categoria
// ═══════════════════════════════════════════════════════════════════════════

const resultadoLoteamentoQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
  id_loteamento: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
});

relatoriosRouter.get(
  "/resultado-por-loteamento",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = resultadoLoteamentoQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { from, to, id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) return res.status(400).json({ error: "Empresa não definida para o usuário" });

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

    const rows = await AppDataSource.query(query, [idEmpresa, from ?? null, to ?? null, id_loteamento ?? null]);

    type ResultadoRow = { id_loteamento: number | string; loteamento: string; receita: string | number; despesas: string | number };
    const resultado = (rows as ResultadoRow[]).map((row) => {
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
  },
);

const dividaLoteamentoQuerySchema = z.object({
  id_loteamento: z.union([z.string(), z.array(z.string())]).optional(),
});

// ─── GET /divida-por-loteamento?id_loteamento=1&id_loteamento=2 — quanto cada
// loteamento tem vendido, pago, atrasado e ainda a vencer (um ou mais loteamentos,
// ou todos se nenhum for informado) ────────────────────────────────────────────
relatoriosRouter.get(
  "/divida-por-loteamento",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = dividaLoteamentoQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) return res.status(400).json({ error: "Empresa não definida para o usuário" });

    const raw = parseResult.data.id_loteamento;
    const ids = (Array.isArray(raw) ? raw : raw ? [raw] : [])
      .map((v) => parseInt(v, 10))
      .filter((n) => Number.isInteger(n) && n > 0);

    const params: unknown[] = [idEmpresa];
    let loteamentoFilter = "";
    if (ids.length > 0) {
      params.push(ids);
      loteamentoFilter = `AND lo.id_loteamento = ANY($${params.length}::int[])`;
    }

    const rows = await AppDataSource.query(
      `
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
      `,
      params
    );

    type Row = {
      id_loteamento: number;
      nome: string;
      cidade: string | null;
      estado: string | null;
      total_vendido: string | number;
      total_pago: string | number;
      total_atrasado: string | number;
      total_a_vencer: string | number;
      qtd_atrasadas: string | number;
      qtd_a_vencer: string | number;
      qtd_vendas: string | number;
    };

    const resultado = (rows as Row[]).map((r) => {
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
  },
);

// ─── GET /lotes-por-loteamento — total de lotes, disponíveis e vendidos por
// loteamento (um lote conta como vendido se tem venda não cancelada) ──────────
relatoriosRouter.get(
  "/lotes-por-loteamento",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) return res.status(400).json({ error: "Empresa não definida para o usuário" });

    const rows = await AppDataSource.query(
      `
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
      `,
      [idEmpresa]
    );

    type Row = {
      id_loteamento: number;
      nome: string;
      cidade: string | null;
      estado: string | null;
      total_lotes: string | number;
      vendidos: string | number;
      disponiveis: string | number;
    };

    const resultado = (rows as Row[]).map((r) => {
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
  },
);

const despesasEmAbertoQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
  id_loteamento: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
  apenas_atraso: z.enum(["true", "false"]).optional(),
});

relatoriosRouter.get(
  "/despesas-em-aberto",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = despesasEmAbertoQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { from, to, id_loteamento, apenas_atraso } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) return res.status(400).json({ error: "Empresa não definida para o usuário" });

    const params: unknown[] = [idEmpresa];
    const conditions = ["dp.situacao = 'aberto'", "dp.id_empresa = $1"];

    if (from) { params.push(from); conditions.push(`dp.vencimento >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`dp.vencimento <= $${params.length}`); }
    if (typeof id_loteamento === "number") { params.push(id_loteamento); conditions.push(`d.id_loteamento = $${params.length}`); }
    if (apenas_atraso === "true") { conditions.push("dp.vencimento < CURRENT_DATE"); }

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

    const rows = await AppDataSource.query(query, params);

    type DespesaAbertaRow = {
      id_despesa_parcela: number;
      descricao: string;
      loteamento: string;
      categoria: string | null;
      fornecedor: string | null;
      parcela: string;
      vencimento: string;
      valor: string | number;
      dias_atraso: number | string;
    };

    const resultado = (rows as DespesaAbertaRow[]).map((row) => ({
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
  },
);

const fluxoCaixaQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
});

relatoriosRouter.get(
  "/fluxo-de-caixa",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = fluxoCaixaQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) return res.status(400).json({ error: "Empresa não definida para o usuário" });

    const hoje = new Date();
    const from = parseResult.data.from ?? new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1).toISOString().slice(0, 10);
    const to = parseResult.data.to ?? hoje.toISOString().slice(0, 10);

    const resultado = (await fluxoFinanceiroMensal(idEmpresa, from, to)).map((item) => ({
      mes: item.mes,
      entradas: item.receita,
      saidas: item.despesa,
      saldo: item.resultado,
    }));

    return res.json(resultado);
  },
);

const fluxoCaixaFuturoQuerySchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido (use YYYY-MM)").optional(),
});

// ─── GET /fluxo-de-caixa-futuro?mes=YYYY-MM — projeção de caixa do mês: saldo
// inicial (real, hoje, projetado até o início do mês selecionado), o que tem a
// pagar/receber dia a dia, saldo projetado por dia e alertas de risco de caixa ─
relatoriosRouter.get(
  "/fluxo-de-caixa-futuro",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = fluxoCaixaFuturoQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) return res.status(400).json({ error: "Empresa não definida para o usuário" });

    const hoje = new Date();
    const mesParam = parseResult.data.mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const [anoSel, mesSel] = mesParam.split("-").map(Number);
    const inicioMes = new Date(anoSel, mesSel - 1, 1).toISOString().slice(0, 10);
    const fimMes = new Date(anoSel, mesSel, 0).toISOString().slice(0, 10);
    const hojeIso = hoje.toISOString().slice(0, 10);

    const saldoHoje = await saldoAtualGeralEmpresa(idEmpresa);

    // Se o mês selecionado é futuro, soma o que está previsto (aberto) para
    // acontecer entre hoje e o início do mês, assumindo que será pago/recebido
    // na data de vencimento. Para o mês atual (ou passado) esse intervalo é vazio.
    let ajustePreMes = 0;
    if (inicioMes > hojeIso) {
      const rows = await AppDataSource.query(
        `
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
        `,
        [idEmpresa, hojeIso, inicioMes]
      );
      ajustePreMes = Number((rows[0] as { ajuste: string | number })?.ajuste ?? 0);
    }

    const saldoInicialPeriodo = saldoHoje + ajustePreMes;

    const [aPagarRows, aReceberRows] = await Promise.all([
      AppDataSource.query(
        `
        SELECT TO_CHAR(dp.vencimento, 'YYYY-MM-DD') AS data, d.descricao AS descricao, dp.valor AS valor, f.nome AS terceiro
        FROM despesa_parcelas dp
        JOIN despesas d ON d.id_despesa = dp.id_despesa
        LEFT JOIN fornecedores f ON f.id_fornecedor = d.id_fornecedor
        WHERE dp.id_empresa = $1 AND dp.situacao = 'aberto'
          AND dp.vencimento >= $2 AND dp.vencimento <= $3
        ORDER BY dp.vencimento ASC
        `,
        [idEmpresa, inicioMes, fimMes]
      ),
      AppDataSource.query(
        `
        SELECT TO_CHAR(p.vencimento, 'YYYY-MM-DD') AS data,
               CONCAT('Venda #', v.id_venda, ' — parcela ', p.numero_parcela) AS descricao,
               p.valor AS valor, cli.nome AS terceiro
        FROM pagamentos p
        JOIN vendas v ON v.id_venda = p.id_venda
        JOIN clientes cli ON cli.id_cliente = v.id_cliente
        WHERE p.id_empresa = $1 AND p.situacao = 'aberto' AND v.status <> 'cancelada'
          AND p.vencimento >= $2 AND p.vencimento <= $3
        ORDER BY p.vencimento ASC
        `,
        [idEmpresa, inicioMes, fimMes]
      ),
    ]);

    type ItemRow = { data: string; descricao: string; valor: string | number; terceiro: string | null };

    const totalAPagar = (aPagarRows as ItemRow[]).reduce((acc, r) => acc + Number(r.valor), 0);
    const totalAReceber = (aReceberRows as ItemRow[]).reduce((acc, r) => acc + Number(r.valor), 0);

    const qtdDias = Number(fimMes.slice(-2));
    const itensPagarPorDia = new Map<string, ItemRow[]>();
    for (const r of aPagarRows as ItemRow[]) {
      const lista = itensPagarPorDia.get(r.data) ?? [];
      lista.push(r);
      itensPagarPorDia.set(r.data, lista);
    }
    const itensReceberPorDia = new Map<string, ItemRow[]>();
    for (const r of aReceberRows as ItemRow[]) {
      const lista = itensReceberPorDia.get(r.data) ?? [];
      lista.push(r);
      itensReceberPorDia.set(r.data, lista);
    }

    let saldoCorrente = saldoInicialPeriodo;
    const dias: Array<{
      data: string;
      aPagar: number;
      aReceber: number;
      resultadoDia: number;
      saldoDia: number;
      itensPagar: { descricao: string; valor: number; terceiro: string | null }[];
      itensReceber: { descricao: string; valor: number; terceiro: string | null }[];
    }> = [];

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
  },
);

// ─── GET /fluxo-de-caixa-previsto — previsão mensal (próximos 12 meses) de
// entradas (parcelas de venda em aberto), saídas (contas a pagar em aberto) e
// saldo projetado das contas, partindo do saldo real de hoje ──────────────────
relatoriosRouter.get(
  "/fluxo-de-caixa-previsto",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) return res.status(400).json({ error: "Empresa não definida para o usuário" });

    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 0).toISOString().slice(0, 10);

    const [saldoHoje, saidasRows, entradasRows] = await Promise.all([
      saldoAtualGeralEmpresa(idEmpresa),
      AppDataSource.query(
        `SELECT TO_CHAR(dp.vencimento, 'YYYY-MM') AS mes, SUM(dp.valor) AS total
         FROM despesa_parcelas dp
         WHERE dp.id_empresa = $1 AND dp.situacao = 'aberto'
           AND dp.vencimento >= $2 AND dp.vencimento <= $3
         GROUP BY mes ORDER BY mes`,
        [idEmpresa, inicioMes, fimPeriodo]
      ),
      AppDataSource.query(
        `SELECT TO_CHAR(p.vencimento, 'YYYY-MM') AS mes, SUM(p.valor) AS total
         FROM pagamentos p
         JOIN vendas v ON v.id_venda = p.id_venda
         WHERE p.id_empresa = $1 AND p.situacao = 'aberto' AND v.status <> 'cancelada'
           AND p.vencimento >= $2 AND p.vencimento <= $3
         GROUP BY mes ORDER BY mes`,
        [idEmpresa, inicioMes, fimPeriodo]
      ),
    ]);

    type MesRow = { mes: string; total: string | number | null };
    const saidasMap = new Map((saidasRows as MesRow[]).map((r) => [r.mes, Number(r.total ?? 0)]));
    const entradasMap = new Map((entradasRows as MesRow[]).map((r) => [r.mes, Number(r.total ?? 0)]));

    let saldoCorrente = saldoHoje;
    const meses: Array<{ mes: string; entradas: number; saidas: number; saldo: number }> = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entradas = entradasMap.get(chave) ?? 0;
      const saidas = saidasMap.get(chave) ?? 0;
      saldoCorrente += entradas - saidas;
      meses.push({ mes: chave, entradas, saidas, saldo: saldoCorrente });
    }

    return res.json(meses);
  },
);

const despesasPorCategoriaQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
  id_loteamento: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
});

relatoriosRouter.get(
  "/despesas-por-categoria",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = despesasPorCategoriaQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { from, to, id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) return res.status(400).json({ error: "Empresa não definida para o usuário" });

    const params: unknown[] = [idEmpresa];
    const conditions = ["dp.id_empresa = $1"];
    if (from) { params.push(from); conditions.push(`d.created_at::date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`d.created_at::date <= $${params.length}`); }
    if (typeof id_loteamento === "number") { params.push(id_loteamento); conditions.push(`d.id_loteamento = $${params.length}`); }

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

    const rows = await AppDataSource.query(query, params);

    type CategoriaRow = {
      id_categoria: number;
      categoria: string;
      grupo: string | null;
      qtd_despesas: string | number;
      valor_total: string | number | null;
      valor_pago: string | number | null;
    };

    const resultado = (rows as CategoriaRow[]).map((row) => ({
      id_categoria: Number(row.id_categoria),
      categoria: row.categoria,
      grupo: row.grupo ?? "—",
      qtdDespesas: Number(row.qtd_despesas ?? 0),
      valorTotal: Number(row.valor_total ?? 0),
      valorPago: Number(row.valor_pago ?? 0),
    }));

    return res.json(resultado);
  },
);

// ═══════════════════════════════════════════════════════════════════════════
//  DRE Mensal — geral ou por loteamento
// ═══════════════════════════════════════════════════════════════════════════

const dreMensalQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida").optional(),
  id_loteamento: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
});

const LANCAMENTOS_GRUPO_LABEL = "Lançamentos Manuais";

relatoriosRouter.get(
  "/dre-mensal",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = dreMensalQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { id_loteamento } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) return res.status(400).json({ error: "Empresa não definida para o usuário" });

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

    const lancPorGrupoQuery = (tipo: "receita" | "despesa", fallback: string) => {
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
      AppDataSource.query(receitaVendasQuery, receitaVendasParams),
      AppDataSource.query(lancPorGrupoQuery("receita", "Outras receitas"), lancParams),
      AppDataSource.query(lancPorGrupoQuery("despesa", LANCAMENTOS_GRUPO_LABEL), lancParams),
      AppDataSource.query(despesasPorGrupoQuery, receitaVendasParams),
    ]);

    type GrupoRow = { mes: string; grupo: string; total: string | number | null };

    interface DreMes {
      mes: string;
      receita: number;
      receitaPorGrupo: Record<string, number>;
      despesasPorGrupo: Record<string, number>;
      despesasTotal: number;
      resultado: number;
    }
    const porMes = new Map<string, DreMes>();

    function getMes(mes: string): DreMes {
      let m = porMes.get(mes);
      if (!m) {
        m = { mes, receita: 0, receitaPorGrupo: {}, despesasPorGrupo: {}, despesasTotal: 0, resultado: 0 };
        porMes.set(mes, m);
      }
      return m;
    }

    for (const r of [...(receitaVendasRows as GrupoRow[]), ...(lancReceitaRows as GrupoRow[])]) {
      const m = getMes(r.mes);
      const valor = Number(r.total ?? 0);
      m.receitaPorGrupo[r.grupo] = (m.receitaPorGrupo[r.grupo] ?? 0) + valor;
      m.receita += valor;
    }
    for (const r of [...(despesasGrupoRows as GrupoRow[]), ...(lancDespesaRows as GrupoRow[])]) {
      const m = getMes(r.mes);
      const valor = Number(r.total ?? 0);
      m.despesasPorGrupo[r.grupo] = (m.despesasPorGrupo[r.grupo] ?? 0) + valor;
      m.despesasTotal += valor;
    }

    const resultado = Array.from(porMes.values())
      .map((m) => ({ ...m, resultado: m.receita - m.despesasTotal }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    return res.json(resultado);
  },
);
