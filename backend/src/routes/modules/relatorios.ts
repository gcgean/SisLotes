import { Request, Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const relatoriosRouter = Router();

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
      WHERE
        p.situacao = 'pago'
        AND p.pago_data IS NOT NULL
        AND p.id_empresa = $1
        AND p.id_conta = $2
        AND EXTRACT(YEAR FROM p.pago_data) = $3::int
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
});

const enderecosCarneQuerySchema = z.object({
  id_loteamento: z
    .string()
    .regex(/^\d+$/, "Loteamento inválido")
    .transform((value) => parseInt(value, 10))
    .optional(),
});

relatoriosRouter.get(
  "/titulos-em-atraso",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parseResult = atrasosQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }

    const { from, to, dias_atraso, id_loteamento, cliente } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;

    if (!idEmpresa) {
      return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }

    const params: unknown[] = [idEmpresa];

    const conditions: string[] = ["p.situacao = 'aberto'", "p.vencimento < CURRENT_DATE", "p.id_empresa = $1"];

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

    const query = `
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
          WHERE
            p.id_empresa = $1
            AND p.situacao = 'pago'
            AND p.pago_data >= date_trunc('month', CURRENT_DATE)
            AND p.pago_data < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')
        ) AS recebido_mes
    `;

    const rows = await AppDataSource.query(query, [idEmpresa]);

    if (!rows || rows.length === 0) {
      return res.json({
        totalClientes: 0,
        vendasAtivas: 0,
        recebidoMes: 0,
      });
    }

    type DashboardRow = {
      total_clientes: string | number;
      vendas_ativas: string | number;
      recebido_mes: string | number | null;
    };

    const row = rows[0] as DashboardRow;

    return res.json({
      totalClientes: Number(row.total_clientes ?? 0),
      vendasAtivas: Number(row.vendas_ativas ?? 0),
      recebidoMes: Number(row.recebido_mes ?? 0),
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
