import { Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Conta } from "../../entities/Conta";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const contasRouter = Router();

const contaBodySchema = z.object({
  apelido: z.string().min(1),
  titular: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  convenio: z.string().optional().nullable(),
  tipo: z.enum(["banco", "caixa"]).optional(),
  saldo_inicial: z.number().optional(),
  data_saldo_inicial: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

// ─── GET / — lista contas com saldo atual; ?ativo=true|false filtra por status ─
contasRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const idEmpresa = req.user?.id_empresa ?? 1;

  const conditions = ["c.id_empresa = $1"];
  const params: unknown[] = [idEmpresa];
  if (req.query.ativo !== undefined) {
    params.push(req.query.ativo === "true");
    conditions.push(`c.ativo = $${params.length}`);
  }

  const rows = await AppDataSource.query(
    `
    SELECT
      c.*,
      c.saldo_inicial
        + COALESCE((
            SELECT SUM(COALESCE(p.valor_pago, p.valor)) FROM pagamentos p
            JOIN vendas v ON v.id_venda = p.id_venda
            WHERE p.id_conta = c.id_conta AND p.situacao = 'pago' AND v.status <> 'cancelada'
              AND (c.data_saldo_inicial IS NULL OR p.pago_data >= c.data_saldo_inicial)
          ), 0)
        + COALESCE((
            SELECT SUM(l.valor) FROM lancamentos_manuais l
            WHERE l.id_conta = c.id_conta AND l.tipo = 'receita'
              AND (c.data_saldo_inicial IS NULL OR l.data >= c.data_saldo_inicial)
          ), 0)
        - COALESCE((
            SELECT SUM(dp.valor_pago) FROM despesa_parcelas dp
            WHERE dp.id_conta = c.id_conta AND dp.situacao = 'pago'
              AND (c.data_saldo_inicial IS NULL OR dp.pago_data >= c.data_saldo_inicial)
          ), 0)
        - COALESCE((
            SELECT SUM(l2.valor) FROM lancamentos_manuais l2
            WHERE l2.id_conta = c.id_conta AND l2.tipo = 'despesa'
              AND (c.data_saldo_inicial IS NULL OR l2.data >= c.data_saldo_inicial)
          ), 0) AS saldo_atual
    FROM contas c
    WHERE ${conditions.join(" AND ")}
    ORDER BY c.apelido ASC
    `,
    params
  );

  type Row = Record<string, unknown> & { saldo_atual: string | number };
  const resultado = (rows as Row[]).map((r) => ({ ...r, saldo_atual: Number(r.saldo_atual ?? 0) }));

  return res.json(resultado);
});

// Soma o delta (créditos - débitos) de todas as contas da empresa, respeitando o
// corte de saldo inicial de cada conta. ateExclusive limita a data (< ateExclusive);
// sem ateExclusive, soma o histórico inteiro (usado para o saldo atual "de hoje").
export async function deltaMovimentosEmpresa(idEmpresa: number, ateExclusive?: string): Promise<number> {
  const params: unknown[] = [idEmpresa];
  let cutoffP = "";
  let cutoffL = "";
  let cutoffDp = "";
  let cutoffL2 = "";
  if (ateExclusive) {
    params.push(ateExclusive);
    cutoffP = "AND p.pago_data < $2";
    cutoffL = "AND l.data < $2";
    cutoffDp = "AND dp.pago_data < $2";
    cutoffL2 = "AND l2.data < $2";
  }

  const rows = await AppDataSource.query(
    `
    SELECT
      COALESCE((
        SELECT SUM(COALESCE(p.valor_pago, p.valor)) FROM pagamentos p
        JOIN vendas v ON v.id_venda = p.id_venda
        JOIN contas c ON c.id_conta = p.id_conta
        WHERE c.id_empresa = $1 AND p.situacao = 'pago' AND v.status <> 'cancelada'
          AND p.pago_data >= COALESCE(c.data_saldo_inicial, '1900-01-01') ${cutoffP}
      ), 0)
      + COALESCE((
        SELECT SUM(l.valor) FROM lancamentos_manuais l
        JOIN contas c ON c.id_conta = l.id_conta
        WHERE c.id_empresa = $1 AND l.tipo = 'receita'
          AND l.data >= COALESCE(c.data_saldo_inicial, '1900-01-01') ${cutoffL}
      ), 0)
      - COALESCE((
        SELECT SUM(dp.valor_pago) FROM despesa_parcelas dp
        JOIN contas c ON c.id_conta = dp.id_conta
        WHERE c.id_empresa = $1 AND dp.situacao = 'pago'
          AND dp.pago_data >= COALESCE(c.data_saldo_inicial, '1900-01-01') ${cutoffDp}
      ), 0)
      - COALESCE((
        SELECT SUM(l2.valor) FROM lancamentos_manuais l2
        JOIN contas c ON c.id_conta = l2.id_conta
        WHERE c.id_empresa = $1 AND l2.tipo = 'despesa'
          AND l2.data >= COALESCE(c.data_saldo_inicial, '1900-01-01') ${cutoffL2}
      ), 0) AS delta
    `,
    params
  );

  return Number((rows[0] as { delta: string | number })?.delta ?? 0);
}

// Saldo real, hoje, somando todas as contas da empresa (saldo_inicial + movimentos
// já realizados). Usado como ponto de partida das projeções de fluxo de caixa.
export async function saldoAtualGeralEmpresa(idEmpresa: number): Promise<number> {
  const rows = await AppDataSource.query(`SELECT COALESCE(SUM(saldo_inicial), 0) AS total FROM contas WHERE id_empresa = $1`, [idEmpresa]);
  const saldoInicialTotal = Number((rows[0] as { total: string | number })?.total ?? 0);
  const delta = await deltaMovimentosEmpresa(idEmpresa);
  return saldoInicialTotal + delta;
}

// ─── GET /extrato-geral?from&to — extrato consolidado de todas as contas da
// empresa (estilo extrato bancário: saldo inicial/final do período, créditos e
// débitos em verde/vermelho, saldo corrente por linha e saldo atual geral) ────
contasRouter.get("/extrato-geral", requireAuth, async (req: AuthRequest, res: Response) => {
  const idEmpresa = req.user?.id_empresa ?? 1;

  const querySchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
  const parse = querySchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: "Informe from e to (YYYY-MM-DD)" });
  const { from, to } = parse.data;

  const [saldoInicialRows, deltaAntes, movimentosRows] = await Promise.all([
    AppDataSource.query(`SELECT COALESCE(SUM(saldo_inicial), 0) AS total FROM contas WHERE id_empresa = $1`, [idEmpresa]),
    deltaMovimentosEmpresa(idEmpresa, from),
    AppDataSource.query(
      `
      SELECT * FROM (
        SELECT p.pago_data AS data, 'entrada' AS movimento, 'venda' AS origem,
               CONCAT('Recebimento venda #', v.id_venda, ' — parcela ', p.numero_parcela) AS descricao,
               COALESCE(p.valor_pago, p.valor) AS valor,
               NULL::text AS conta_contabil, c.apelido AS conta_apelido, c.id_conta AS id_conta,
               NULL::int AS id_lancamento
        FROM pagamentos p
        JOIN vendas v ON v.id_venda = p.id_venda
        JOIN contas c ON c.id_conta = p.id_conta
        WHERE c.id_empresa = $1 AND p.situacao = 'pago' AND v.status <> 'cancelada'
          AND p.pago_data >= $2 AND p.pago_data <= $3

        UNION ALL

        SELECT dp.pago_data AS data, 'saida' AS movimento, 'despesa' AS origem,
               d.descricao AS descricao, dp.valor_pago AS valor,
               cat.nome AS conta_contabil, c.apelido AS conta_apelido, c.id_conta AS id_conta,
               NULL::int AS id_lancamento
        FROM despesa_parcelas dp
        JOIN despesas d ON d.id_despesa = dp.id_despesa
        JOIN contas c ON c.id_conta = dp.id_conta
        LEFT JOIN plano_de_contas cat ON cat.id_conta_contabil = d.id_categoria
        WHERE c.id_empresa = $1 AND dp.situacao = 'pago'
          AND dp.pago_data >= $2 AND dp.pago_data <= $3

        UNION ALL

        SELECT l.data AS data, CASE WHEN l.tipo = 'receita' THEN 'entrada' ELSE 'saida' END AS movimento,
               'lancamento' AS origem, l.descricao AS descricao, l.valor AS valor,
               cat.nome AS conta_contabil, c.apelido AS conta_apelido, c.id_conta AS id_conta,
               l.id_lancamento AS id_lancamento
        FROM lancamentos_manuais l
        JOIN contas c ON c.id_conta = l.id_conta
        LEFT JOIN plano_de_contas cat ON cat.id_conta_contabil = l.id_conta_contabil
        WHERE c.id_empresa = $1 AND l.data >= $2 AND l.data <= $3
      ) mov
      ORDER BY data ASC, movimento ASC
      `,
      [idEmpresa, from, to]
    ),
  ]);

  const saldoInicialTotal = Number((saldoInicialRows[0] as { total: string | number })?.total ?? 0);
  const saldoInicialPeriodo = saldoInicialTotal + deltaAntes;

  type MovRow = {
    data: string;
    movimento: "entrada" | "saida";
    origem: string;
    descricao: string;
    valor: string | number;
    conta_contabil: string | null;
    conta_apelido: string;
    id_conta: number;
    id_lancamento: number | null;
  };

  let saldoCorrente = saldoInicialPeriodo;
  let totalCreditos = 0;
  let totalDebitos = 0;
  const movimentos = (movimentosRows as MovRow[]).map((m) => {
    const valor = Number(m.valor ?? 0);
    if (m.movimento === "entrada") {
      saldoCorrente += valor;
      totalCreditos += valor;
    } else {
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
      saldo: saldoCorrente,
    };
  });

  const deltaGeral = await deltaMovimentosEmpresa(idEmpresa);
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
contasRouter.get("/:id/extrato", requireAuth, async (req: AuthRequest, res: Response) => {
  const idEmpresa = req.user?.id_empresa ?? 1;
  const idConta = Number(req.params.id);

  const querySchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
  const parse = querySchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: "Informe from e to (YYYY-MM-DD)" });
  const { from, to } = parse.data;

  const contaRepo = AppDataSource.getRepository(Conta);
  const conta = await contaRepo.findOne({ where: { id_conta: idConta, id_empresa: idEmpresa } });
  if (!conta) return res.status(404).json({ error: "Conta não encontrada" });

  const dataSaldoInicial = conta.data_saldo_inicial ?? "1900-01-01";
  const saldoInicialConta = Number(conta.saldo_inicial ?? 0);

  const [antesRows, movimentosRows] = await Promise.all([
    AppDataSource.query(
      `
      SELECT
        COALESCE((
          SELECT SUM(COALESCE(p.valor_pago, p.valor)) FROM pagamentos p
          JOIN vendas v ON v.id_venda = p.id_venda
          WHERE p.id_conta = $1 AND p.situacao = 'pago' AND v.status <> 'cancelada'
            AND p.pago_data >= $2 AND p.pago_data < $3
        ), 0)
        + COALESCE((
          SELECT SUM(l.valor) FROM lancamentos_manuais l
          WHERE l.id_conta = $1 AND l.tipo = 'receita' AND l.data >= $2 AND l.data < $3
        ), 0)
        - COALESCE((
          SELECT SUM(dp.valor_pago) FROM despesa_parcelas dp
          WHERE dp.id_conta = $1 AND dp.situacao = 'pago' AND dp.pago_data >= $2 AND dp.pago_data < $3
        ), 0)
        - COALESCE((
          SELECT SUM(l2.valor) FROM lancamentos_manuais l2
          WHERE l2.id_conta = $1 AND l2.tipo = 'despesa' AND l2.data >= $2 AND l2.data < $3
        ), 0) AS delta
      `,
      [idConta, dataSaldoInicial, from]
    ),
    AppDataSource.query(
      `
      SELECT * FROM (
        SELECT p.pago_data AS data, 'entrada' AS movimento, 'venda' AS origem,
               CONCAT('Recebimento venda #', v.id_venda, ' — parcela ', p.numero_parcela) AS descricao,
               COALESCE(p.valor_pago, p.valor) AS valor,
               NULL::text AS conta_contabil
        FROM pagamentos p
        JOIN vendas v ON v.id_venda = p.id_venda
        WHERE p.id_conta = $1 AND p.situacao = 'pago' AND v.status <> 'cancelada'
          AND p.pago_data >= $2 AND p.pago_data <= $3

        UNION ALL

        SELECT dp.pago_data AS data, 'saida' AS movimento, 'despesa' AS origem,
               d.descricao AS descricao,
               dp.valor_pago AS valor,
               cat.nome AS conta_contabil
        FROM despesa_parcelas dp
        JOIN despesas d ON d.id_despesa = dp.id_despesa
        LEFT JOIN plano_de_contas cat ON cat.id_conta_contabil = d.id_categoria
        WHERE dp.id_conta = $1 AND dp.situacao = 'pago'
          AND dp.pago_data >= $2 AND dp.pago_data <= $3

        UNION ALL

        SELECT l.data AS data, CASE WHEN l.tipo = 'receita' THEN 'entrada' ELSE 'saida' END AS movimento,
               'lancamento' AS origem, l.descricao AS descricao, l.valor AS valor,
               cat.nome AS conta_contabil
        FROM lancamentos_manuais l
        LEFT JOIN plano_de_contas cat ON cat.id_conta_contabil = l.id_conta_contabil
        WHERE l.id_conta = $1 AND l.data >= $2 AND l.data <= $3
      ) mov
      ORDER BY data ASC
      `,
      [idConta, from, to]
    ),
  ]);

  const saldoInicialPeriodo = saldoInicialConta + Number((antesRows[0] as { delta: string | number })?.delta ?? 0);

  type MovRow = { data: string; movimento: "entrada" | "saida"; origem: string; descricao: string; valor: string | number; conta_contabil: string | null };
  let saldoCorrente = saldoInicialPeriodo;
  const movimentos = (movimentosRows as MovRow[]).map((m) => {
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

// ─── POST / ───────────────────────────────────────────────────────────────────
contasRouter.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const parseResult = contaBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const data = parseResult.data;
  const tipo = data.tipo ?? "banco";

  const repo = AppDataSource.getRepository(Conta);

  const conta = repo.create({
    ...data,
    tipo,
    saldo_inicial: String(data.saldo_inicial ?? 0),
    ativo: data.ativo ?? true,
    id_empresa: req.user?.id_empresa ?? 1,
  });

  const saved = await repo.save(conta);

  return res.status(201).json(saved);
});

// ─── PUT /:id — editar dados ──────────────────────────────────────────────────
contasRouter.put("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const parseResult = contaBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Conta);

  const where: Record<string, unknown> = { id_conta: Number(id) };
  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const conta = await repo.findOne({ where });

  if (!conta) {
    return res.status(404).json({ error: "Conta não encontrada" });
  }

  const { saldo_inicial, ...rest } = parseResult.data;
  Object.assign(conta, rest);
  if (saldo_inicial !== undefined) conta.saldo_inicial = String(saldo_inicial);

  const saved = await repo.save(conta);

  return res.json(saved);
});

// ─── PATCH /:id/ativo — ativar / desativar ────────────────────────────────────
contasRouter.patch("/:id/ativo", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { ativo } = req.body as { ativo?: boolean };

  if (typeof ativo !== "boolean") {
    return res.status(400).json({ error: "Campo 'ativo' deve ser boolean" });
  }

  const repo = AppDataSource.getRepository(Conta);

  const where: Record<string, unknown> = { id_conta: Number(id) };
  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const conta = await repo.findOne({ where });

  if (!conta) {
    return res.status(404).json({ error: "Conta não encontrada" });
  }

  conta.ativo = ativo;
  const saved = await repo.save(conta);

  return res.json(saved);
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
contasRouter.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Conta);

  const where: Record<string, unknown> = { id_conta: Number(id) };
  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const conta = await repo.findOne({ where });

  if (!conta) {
    return res.status(404).json({ error: "Conta não encontrada" });
  }

  await repo.remove(conta);

  return res.status(204).send();
});
