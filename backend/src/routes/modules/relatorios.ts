import { Request, Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const relatoriosRouter = Router();

const entradasQuerySchema = z.object({
  ano: z
    .string()
    .regex(/^\d{4}$/, "Ano inválido")
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

    const { ano } = parseResult.data;
    const idEmpresa = req.user?.id_empresa;

    if (!idEmpresa) {
      return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }

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
      WHERE
        p.situacao = 'pago'
        AND p.pago_data IS NOT NULL
        AND EXTRACT(YEAR FROM p.pago_data) = $1
        AND p.id_empresa = $2
      GROUP BY lot.id_loteamento, lot.nome, mes
      ORDER BY lot.nome, mes
    `;

    const rows = await AppDataSource.query(query, [ano, idEmpresa]);

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
          total: 0,
        };
      }

      if (mes === 1) byLoteamento[id].jan += total;
      if (mes === 2) byLoteamento[id].fev += total;
      if (mes === 3) byLoteamento[id].mar += total;
      if (mes === 4) byLoteamento[id].abr += total;
      byLoteamento[id].total += total;
    }

    for (const value of Object.values(byLoteamento)) {
      resultado.push(value);
    }

    return res.json(resultado);
  },
);

relatoriosRouter.get(
  "/titulos-em-atraso",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const idEmpresa = req.user?.id_empresa;

    if (!idEmpresa) {
      return res.status(400).json({ error: "Empresa não definida para o usuário" });
    }

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
      WHERE
        p.situacao = 'aberto'
        AND p.vencimento < CURRENT_DATE
        AND p.id_empresa = $1
      ORDER BY p.vencimento ASC
    `;

    const rows = await AppDataSource.query(query, [idEmpresa]);

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
