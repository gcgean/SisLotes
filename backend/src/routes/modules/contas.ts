import { Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Conta } from "../../entities/Conta";
import { AuthRequest, requireAuth } from "../../middleware/auth";
import { AuditoriaService } from "../../services/AuditoriaService";

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
            SELECT SUM(CASE WHEN mf.tipo = 'receita' THEN mf.valor ELSE -mf.valor END)
            FROM movimentos_financeiros mf
            WHERE mf.id_conta = c.id_conta
              AND (c.data_saldo_inicial IS NULL OR mf.data >= c.data_saldo_inicial)
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

// Soma o delta (créditos - débitos) das contas da empresa (ou de uma única conta,
// se idConta for informado), respeitando o corte de saldo inicial de cada conta.
// ateExclusive limita a data (< ateExclusive); sem ateExclusive, soma o histórico
// inteiro (usado para o saldo atual "de hoje").
export async function deltaMovimentosEmpresa(idEmpresa: number, ateExclusive?: string, idConta?: number): Promise<number> {
  const params: unknown[] = [idEmpresa];
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

  const rows = await AppDataSource.query(
    `
    SELECT
      COALESCE((
        SELECT SUM(CASE WHEN mf.tipo = 'receita' THEN mf.valor ELSE -mf.valor END)
        FROM movimentos_financeiros mf
        JOIN contas c ON c.id_conta = mf.id_conta
        WHERE c.id_empresa = $1
          AND mf.data >= COALESCE(c.data_saldo_inicial, '1900-01-01') ${cutoff} ${contaClause}
      ), 0) AS delta
    `,
    params
  );

  return Number((rows[0] as { delta: string | number })?.delta ?? 0);
}

// Saldo real, hoje, somando todas as contas da empresa (saldo_inicial + movimentos
// já realizados). Usado como ponto de partida das projeções de fluxo de caixa.
export async function saldoAtualGeralEmpresa(idEmpresa: number, idConta?: number): Promise<number> {
  const params: unknown[] = [idEmpresa];
  let contaClause = "";
  if (idConta) {
    params.push(idConta);
    contaClause = `AND id_conta = $${params.length}`;
  }
  const rows = await AppDataSource.query(
    `SELECT COALESCE(SUM(saldo_inicial), 0) AS total FROM contas WHERE id_empresa = $1 ${contaClause}`,
    params
  );
  const saldoInicialTotal = Number((rows[0] as { total: string | number })?.total ?? 0);
  const delta = await deltaMovimentosEmpresa(idEmpresa, undefined, idConta);
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
    id_conta: z.coerce.number().int().positive().optional(),
  });
  const parse = querySchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: "Informe from e to (YYYY-MM-DD)" });
  const { from, to, id_conta: idConta } = parse.data;

  const saldoInicialParams: unknown[] = [idEmpresa];
  const saldoInicialContaClause = idConta ? (saldoInicialParams.push(idConta), `AND id_conta = $${saldoInicialParams.length}`) : "";

  const movParams: unknown[] = [idEmpresa, from, to];
  const movContaClause = idConta ? (movParams.push(idConta), `AND c.id_conta = $${movParams.length}`) : "";

  const [saldoInicialRows, deltaAntes, movimentosRows] = await Promise.all([
    AppDataSource.query(
      `SELECT COALESCE(SUM(saldo_inicial), 0) AS total FROM contas WHERE id_empresa = $1 ${saldoInicialContaClause}`,
      saldoInicialParams
    ),
    deltaMovimentosEmpresa(idEmpresa, from, idConta),
    AppDataSource.query(
      `
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
      `,
      movParams
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
    id_transferencia: number | null;
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
          SELECT SUM(CASE WHEN mf.tipo = 'receita' THEN mf.valor ELSE -mf.valor END)
          FROM movimentos_financeiros mf
          WHERE mf.id_conta = $1 AND mf.data >= $2 AND mf.data < $3
        ), 0) AS delta
      `,
      [idConta, dataSaldoInicial, from]
    ),
    AppDataSource.query(
      `
      SELECT TO_CHAR(mf.data, 'YYYY-MM-DD') AS data,
             CASE WHEN mf.tipo = 'receita' THEN 'entrada' ELSE 'saida' END AS movimento,
             mf.origem, mf.descricao, mf.valor, cat.nome AS conta_contabil
      FROM movimentos_financeiros mf
      LEFT JOIN plano_de_contas cat ON cat.id_conta_contabil = mf.id_conta_contabil
      WHERE mf.id_conta = $1 AND mf.data >= $2 AND mf.data <= $3
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
  await AuditoriaService.registrar(req, "contas", "CREATE", saved.id_conta, undefined, {
    apelido: saved.apelido, tipo: saved.tipo, saldo_inicial: saved.saldo_inicial, data_saldo_inicial: saved.data_saldo_inicial, ativo: saved.ativo,
  }, `Conta financeira criada — ${saved.apelido}`);

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
  const valoresAntigos = { apelido: conta.apelido, tipo: conta.tipo, saldo_inicial: conta.saldo_inicial, data_saldo_inicial: conta.data_saldo_inicial, ativo: conta.ativo };

  const { saldo_inicial, ...rest } = parseResult.data;
  Object.assign(conta, rest);
  if (saldo_inicial !== undefined) conta.saldo_inicial = String(saldo_inicial);

  const saved = await repo.save(conta);
  await AuditoriaService.registrar(req, "contas", "UPDATE", saved.id_conta, valoresAntigos, {
    apelido: saved.apelido, tipo: saved.tipo, saldo_inicial: saved.saldo_inicial, data_saldo_inicial: saved.data_saldo_inicial, ativo: saved.ativo,
  }, `Conta financeira editada — ${saved.apelido}`);

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
  const ativoAnterior = conta.ativo;

  conta.ativo = ativo;
  const saved = await repo.save(conta);
  await AuditoriaService.registrar(req, "contas", "UPDATE", saved.id_conta, { ativo: ativoAnterior }, { ativo: saved.ativo }, `${saved.ativo ? "Conta ativada" : "Conta desativada"} — ${saved.apelido}`);

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
  await AuditoriaService.registrar(req, "contas", "DELETE", Number(id), {
    apelido: conta.apelido, tipo: conta.tipo, saldo_inicial: conta.saldo_inicial, data_saldo_inicial: conta.data_saldo_inicial, ativo: conta.ativo,
  }, undefined, `Conta financeira excluída — ${conta.apelido}`);

  return res.status(204).send();
});
