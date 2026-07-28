import { Response, Router } from "express";
import { z } from "zod";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { PlanoDeContas } from "../../entities/PlanoDeContas";
import { Fornecedor } from "../../entities/Fornecedor";
import { Despesa } from "../../entities/Despesa";
import { DespesaParcela } from "../../entities/DespesaParcela";
import { Log } from "../../entities/Log";
import { AuthRequest, requireAuth, requireFeature } from "../../middleware/auth";

export const despesasRouter = Router();
despesasRouter.use(requireAuth, requireFeature("module_despesas"));

// ═══════════════════════════════════════════════════════════════════════════
//  Plano de Contas (árvore: grupo > subgrupo > conta)
// ═══════════════════════════════════════════════════════════════════════════

const planoContasBodySchema = z.object({
  id_pai: z.number().int().positive().optional().nullable(),
  tipo: z.enum(["receita", "despesa"]).optional(),
  nome: z.string().min(1).max(150),
});

despesasRouter.get("/plano-de-contas", async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(PlanoDeContas);
  const where: Record<string, unknown> = { id_empresa: req.user!.id_empresa };
  if (req.query.ativo !== undefined) where.ativo = req.query.ativo === "true";
  if (req.query.tipo === "receita" || req.query.tipo === "despesa") where.tipo = req.query.tipo;
  const contas = await repo.find({ where, order: { codigo: "ASC" } });
  return res.json(contas);
});

despesasRouter.post("/plano-de-contas", async (req: AuthRequest, res: Response) => {
  const parse = planoContasBodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const repo = AppDataSource.getRepository(PlanoDeContas);
  const idEmpresa = req.user!.id_empresa;
  const { id_pai, nome } = parse.data;
  let tipo = parse.data.tipo;

  let pai: PlanoDeContas | null = null;
  if (id_pai) {
    pai = await repo.findOne({ where: { id_conta_contabil: id_pai, id_empresa: idEmpresa } });
    if (!pai) return res.status(404).json({ error: "Conta pai não encontrada" });
    tipo = pai.tipo;
  }
  if (!tipo) return res.status(400).json({ error: "Informe o tipo (receita ou despesa) para uma conta raiz" });

  const irmaos = await repo.count({ where: { id_empresa: idEmpresa, id_pai: id_pai ? id_pai : IsNull() } });
  const proximoNumero = irmaos + 1;
  const codigo = pai ? `${pai.codigo}.${proximoNumero}` : String(proximoNumero);

  const conta = repo.create({ id_empresa: idEmpresa, id_pai: id_pai ?? null, tipo, codigo, nome, ativo: true });
  const saved = await repo.save(conta);
  return res.status(201).json(saved);
});

despesasRouter.put("/plano-de-contas/:id", async (req: AuthRequest, res: Response) => {
  const parse = z.object({ nome: z.string().min(1).max(150).optional(), ativo: z.boolean().optional() }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const repo = AppDataSource.getRepository(PlanoDeContas);
  const conta = await repo.findOne({
    where: { id_conta_contabil: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!conta) return res.status(404).json({ error: "Conta não encontrada" });

  Object.assign(conta, parse.data);
  const saved = await repo.save(conta);
  return res.json(saved);
});

despesasRouter.delete("/plano-de-contas/:id", async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(PlanoDeContas);
  const idEmpresa = req.user!.id_empresa;
  const conta = await repo.findOne({ where: { id_conta_contabil: Number(req.params.id), id_empresa: idEmpresa } });
  if (!conta) return res.status(404).json({ error: "Conta não encontrada" });

  const temFilhos = await repo.count({ where: { id_pai: conta.id_conta_contabil, id_empresa: idEmpresa } });
  if (temFilhos > 0) {
    return res.status(409).json({ error: "Esta conta tem sub-contas — remova ou mova as sub-contas antes de excluir." });
  }

  const emUsoDespesas = await AppDataSource.getRepository(Despesa).count({
    where: { id_categoria: conta.id_conta_contabil, id_empresa: idEmpresa },
  });
  const emUsoLancamentos = await AppDataSource.query(
    `SELECT COUNT(*)::int AS total FROM lancamentos_manuais WHERE id_conta_contabil = $1 AND id_empresa = $2`,
    [conta.id_conta_contabil, idEmpresa]
  );
  if (emUsoDespesas > 0 || Number(emUsoLancamentos[0]?.total ?? 0) > 0) {
    return res.status(409).json({ error: "Conta em uso por despesas ou lançamentos — desative em vez de excluir." });
  }

  await repo.remove(conta);
  return res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
//  Fornecedores
// ═══════════════════════════════════════════════════════════════════════════

const fornecedorBodySchema = z.object({
  nome: z.string().min(1),
  documento: z.string().max(18).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  contato: z.string().max(200).optional().nullable(),
  observacoes: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

despesasRouter.get("/fornecedores", async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(Fornecedor);
  const where: Record<string, unknown> = { id_empresa: req.user?.id_empresa };
  if (req.query.ativo !== undefined) where.ativo = req.query.ativo === "true";
  const fornecedores = await repo.find({ where, order: { nome: "ASC" } });
  return res.json(fornecedores);
});

despesasRouter.post("/fornecedores", async (req: AuthRequest, res: Response) => {
  const parse = fornecedorBodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const repo = AppDataSource.getRepository(Fornecedor);
  const fornecedor = repo.create({
    ...parse.data,
    ativo: parse.data.ativo ?? true,
    id_empresa: req.user!.id_empresa,
  });
  const saved = await repo.save(fornecedor);
  return res.status(201).json(saved);
});

despesasRouter.put("/fornecedores/:id", async (req: AuthRequest, res: Response) => {
  const parse = fornecedorBodySchema.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const repo = AppDataSource.getRepository(Fornecedor);
  const fornecedor = await repo.findOne({
    where: { id_fornecedor: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!fornecedor) return res.status(404).json({ error: "Fornecedor não encontrado" });

  Object.assign(fornecedor, parse.data);
  const saved = await repo.save(fornecedor);
  return res.json(saved);
});

despesasRouter.patch("/fornecedores/:id/ativo", async (req: AuthRequest, res: Response) => {
  const { ativo } = req.body as { ativo?: boolean };
  if (typeof ativo !== "boolean") return res.status(400).json({ error: "Campo 'ativo' deve ser boolean" });

  const repo = AppDataSource.getRepository(Fornecedor);
  const fornecedor = await repo.findOne({
    where: { id_fornecedor: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!fornecedor) return res.status(404).json({ error: "Fornecedor não encontrado" });

  fornecedor.ativo = ativo;
  const saved = await repo.save(fornecedor);
  return res.json(saved);
});

despesasRouter.delete("/fornecedores/:id", async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(Fornecedor);
  const fornecedor = await repo.findOne({
    where: { id_fornecedor: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!fornecedor) return res.status(404).json({ error: "Fornecedor não encontrado" });

  const emUso = await AppDataSource.getRepository(Despesa).count({
    where: { id_fornecedor: fornecedor.id_fornecedor, id_empresa: req.user!.id_empresa },
  });
  if (emUso > 0) {
    return res.status(409).json({ error: "Fornecedor em uso por despesas cadastradas — desative em vez de excluir." });
  }

  await repo.remove(fornecedor);
  return res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
//  Despesas + parcelas
// ═══════════════════════════════════════════════════════════════════════════

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Divide valor_total em N parcelas de 2 casas decimais, ajustando o arredondamento na última.
function gerarValoresParcelas(valorTotal: number, numeroParcelas: number): number[] {
  const base = Math.floor((valorTotal / numeroParcelas) * 100) / 100;
  const valores = Array(numeroParcelas).fill(base);
  const somaBase = base * numeroParcelas;
  const resto = Math.round((valorTotal - somaBase) * 100) / 100;
  valores[numeroParcelas - 1] = Math.round((base + resto) * 100) / 100;
  return valores;
}

const despesaBodySchema = z.object({
  id_loteamento: z.number().int().positive().optional().nullable(),
  id_categoria: z.number().int().positive(),
  id_fornecedor: z.number().int().positive().optional().nullable(),
  descricao: z.string().min(1).max(300),
  valor_total: z.number().positive(),
  numero_parcelas: z.number().int().min(1).max(60).default(1),
  data_primeiro_vencimento: z.string(),
  documento: z.string().max(60).optional().nullable(),
  anexo_nome: z.string().max(200).optional().nullable(),
  anexo_base64: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

const listDespesasQuerySchema = z.object({
  id_loteamento: z.string().regex(/^\d+$/).transform(Number).optional(),
  id_categoria: z.string().regex(/^\d+$/).transform(Number).optional(),
  situacao: z.enum(["aberto", "pago", "parcial"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ─── GET / — lista despesas com resumo de parcelas ───────────────────────────
despesasRouter.get("/", async (req: AuthRequest, res: Response) => {
  const parse = listDespesasQuerySchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: "Parâmetros inválidos", issues: parse.error.issues });
  const { id_loteamento, id_categoria, situacao, from, to } = parse.data;
  const idEmpresa = req.user!.id_empresa;

  try {
    const params: unknown[] = [idEmpresa];
    const conditions: string[] = ["d.id_empresa = $1"];

    if (id_loteamento) {
      params.push(id_loteamento);
      conditions.push(`d.id_loteamento = $${params.length}`);
    }
    if (id_categoria) {
      params.push(id_categoria);
      conditions.push(`d.id_categoria = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`d.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`d.created_at <= $${params.length}`);
    }

    const rows = await AppDataSource.query(
      `SELECT
         d.id_despesa, d.id_loteamento, d.id_categoria, d.id_fornecedor,
         d.descricao, d.valor_total, d.numero_parcelas, d.documento, d.observacoes,
         d.anexo_nome, d.created_at, d.updated_at,
         lo.nome AS loteamento_nome,
         c.nome AS categoria_nome, COALESCE(cg.nome, c.nome) AS categoria_grupo,
         f.nome AS fornecedor_nome,
         COALESCE(pc.parcelas_pagas, 0)::int AS parcelas_pagas,
         COALESCE(pc.parcelas_total, d.numero_parcelas)::int AS parcelas_total,
         COALESCE(pc.valor_pago, 0)::numeric AS valor_pago
       FROM despesas d
       LEFT JOIN loteamentos lo ON lo.id_loteamento = d.id_loteamento
       LEFT JOIN plano_de_contas c ON c.id_conta_contabil = d.id_categoria
       LEFT JOIN plano_de_contas cg ON cg.id_conta_contabil = c.id_pai
       LEFT JOIN fornecedores f ON f.id_fornecedor = d.id_fornecedor
       LEFT JOIN (
         SELECT id_despesa,
                COUNT(*) FILTER (WHERE situacao = 'pago') AS parcelas_pagas,
                COUNT(*) AS parcelas_total,
                SUM(valor_pago) FILTER (WHERE situacao = 'pago') AS valor_pago
         FROM despesa_parcelas
         GROUP BY id_despesa
       ) pc ON pc.id_despesa = d.id_despesa
       WHERE ${conditions.join(" AND ")}
       ORDER BY d.created_at DESC`,
      params
    );

    let despesas = rows as Array<Record<string, unknown> & { parcelas_pagas: number; parcelas_total: number }>;

    if (situacao) {
      despesas = despesas.filter((d) => {
        if (situacao === "pago") return d.parcelas_pagas === d.parcelas_total;
        if (situacao === "aberto") return d.parcelas_pagas === 0;
        return d.parcelas_pagas > 0 && d.parcelas_pagas < d.parcelas_total;
      });
    }

    return res.json(despesas);
  } catch (error) {
    console.error("Erro ao listar despesas:", error);
    return res.status(500).json({ error: "Erro ao listar despesas" });
  }
});

// ─── GET /:id — detalhe com parcelas ──────────────────────────────────────────
despesasRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  const idEmpresa = req.user!.id_empresa;
  const rows = await AppDataSource.query(
    `SELECT
       d.*,
       lo.nome AS loteamento_nome,
       c.nome AS categoria_nome, COALESCE(cg.nome, c.nome) AS categoria_grupo,
       f.nome AS fornecedor_nome
     FROM despesas d
     LEFT JOIN loteamentos lo ON lo.id_loteamento = d.id_loteamento
     LEFT JOIN plano_de_contas c ON c.id_conta_contabil = d.id_categoria
     LEFT JOIN plano_de_contas cg ON cg.id_conta_contabil = c.id_pai
     LEFT JOIN fornecedores f ON f.id_fornecedor = d.id_fornecedor
     WHERE d.id_despesa = $1 AND d.id_empresa = $2`,
    [Number(req.params.id), idEmpresa]
  );
  const despesa = rows[0];
  if (!despesa) return res.status(404).json({ error: "Despesa não encontrada" });

  const parcelas = await AppDataSource.getRepository(DespesaParcela).find({
    where: { id_despesa: despesa.id_despesa, id_empresa: idEmpresa },
    order: { numero_parcela: "ASC" },
  });

  return res.json({ ...despesa, parcelas });
});

// ─── POST / — cria despesa + gera parcelas ────────────────────────────────────
despesasRouter.post("/", async (req: AuthRequest, res: Response) => {
  const parse = despesaBodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const data = parse.data;
  const idEmpresa = req.user!.id_empresa;
  const despesaRepo = AppDataSource.getRepository(Despesa);
  const parcelaRepo = AppDataSource.getRepository(DespesaParcela);

  const despesa = despesaRepo.create({
    id_empresa: idEmpresa,
    id_loteamento: data.id_loteamento ?? null,
    id_categoria: data.id_categoria,
    id_fornecedor: data.id_fornecedor ?? null,
    descricao: data.descricao,
    valor_total: data.valor_total.toFixed(2),
    numero_parcelas: data.numero_parcelas,
    documento: data.documento ?? null,
    anexo_nome: data.anexo_nome ?? null,
    anexo_base64: data.anexo_base64 ?? null,
    observacoes: data.observacoes ?? null,
  });
  const despesaSalva = await despesaRepo.save(despesa);

  const valores = gerarValoresParcelas(data.valor_total, data.numero_parcelas);
  const parcelas = valores.map((valor, i) =>
    parcelaRepo.create({
      id_empresa: idEmpresa,
      id_despesa: despesaSalva.id_despesa,
      numero_parcela: i + 1,
      vencimento: addMonths(data.data_primeiro_vencimento, i),
      valor: valor.toFixed(2),
      situacao: "aberto",
    })
  );
  await parcelaRepo.save(parcelas);

  return res.status(201).json({ ...despesaSalva, parcelas });
});

// ─── PUT /:id — edita cabeçalho (bloqueia se já houver parcela paga) ──────────
despesasRouter.put("/:id", async (req: AuthRequest, res: Response) => {
  const parse = despesaBodySchema
    .omit({ numero_parcelas: true, data_primeiro_vencimento: true })
    .partial()
    .safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const despesaRepo = AppDataSource.getRepository(Despesa);
  const despesa = await despesaRepo.findOne({
    where: { id_despesa: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!despesa) return res.status(404).json({ error: "Despesa não encontrada" });

  const parcelaRepo = AppDataSource.getRepository(DespesaParcela);
  const parcelaPaga = await parcelaRepo.count({
    where: { id_despesa: despesa.id_despesa, id_empresa: req.user!.id_empresa, situacao: "pago" },
  });
  if (parcelaPaga > 0) {
    return res.status(409).json({ error: "Despesa já tem parcela paga — não é possível editar os valores." });
  }

  const { valor_total, ...rest } = parse.data;
  Object.assign(despesa, rest);
  if (valor_total != null) despesa.valor_total = valor_total.toFixed(2);
  const saved = await despesaRepo.save(despesa);

  return res.json(saved);
});

// ─── DELETE /:id — bloqueia se houver parcela paga ────────────────────────────
despesasRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  const despesaRepo = AppDataSource.getRepository(Despesa);
  const despesa = await despesaRepo.findOne({
    where: { id_despesa: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!despesa) return res.status(404).json({ error: "Despesa não encontrada" });

  const parcelaRepo = AppDataSource.getRepository(DespesaParcela);
  const parcelaPaga = await parcelaRepo.count({
    where: { id_despesa: despesa.id_despesa, id_empresa: req.user!.id_empresa, situacao: "pago" },
  });
  if (parcelaPaga > 0) {
    return res.status(409).json({ error: "Despesa já tem parcela paga — não é possível excluir." });
  }

  await despesaRepo.remove(despesa); // cascade remove as parcelas (ON DELETE CASCADE)
  return res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
//  Parcelas — pagar / estornar (espelha pagamentos.ts)
// ═══════════════════════════════════════════════════════════════════════════

const pagarSchema = z.object({
  pago_data: z.string(),
  valor_pago: z.number().positive(),
  id_conta: z.number().int().positive().optional().nullable(),
});

despesasRouter.post("/parcelas/:id/pagar", async (req: AuthRequest, res: Response) => {
  const parse = pagarSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const repo = AppDataSource.getRepository(DespesaParcela);
  const parcela = await repo.findOne({
    where: { id_despesa_parcela: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!parcela) return res.status(404).json({ error: "Parcela não encontrada" });
  if (parcela.situacao === "pago") {
    return res.status(409).json({ error: "Esta parcela já foi paga." });
  }

  const { pago_data, valor_pago, id_conta } = parse.data;
  parcela.situacao = "pago";
  parcela.pago_data = pago_data;
  parcela.valor_pago = valor_pago.toFixed(2);
  parcela.id_conta = id_conta ?? null;
  parcela.id_usuario = req.user!.id_usuario;

  const saved = await repo.save(parcela);

  const logRepo = AppDataSource.getRepository(Log);
  await logRepo.save(logRepo.create({
    id_usuario: req.user!.id_usuario,
    servico: "despesa_parcela_pagar",
    url: `/api/despesas/parcelas/${req.params.id}/pagar`,
    log: `Parcela de despesa ${saved.id_despesa_parcela} (despesa ${saved.id_despesa}) paga — valor_pago=${saved.valor_pago}`,
    query: JSON.stringify(parse.data),
  }));

  return res.json(saved);
});

despesasRouter.post("/parcelas/:id/estornar", async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(DespesaParcela);
  const parcela = await repo.findOne({
    where: { id_despesa_parcela: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!parcela) return res.status(404).json({ error: "Parcela não encontrada" });
  if (parcela.situacao !== "pago") {
    return res.status(400).json({ error: "Esta parcela não está paga e não pode ser estornada." });
  }

  parcela.situacao = "aberto";
  parcela.pago_data = null;
  parcela.valor_pago = null;
  parcela.id_conta = null;

  const saved = await repo.save(parcela);

  const logRepo = AppDataSource.getRepository(Log);
  await logRepo.save(logRepo.create({
    id_usuario: req.user!.id_usuario,
    servico: "despesa_parcela_estornar",
    url: `/api/despesas/parcelas/${req.params.id}/estornar`,
    log: `Parcela de despesa ${saved.id_despesa_parcela} (despesa ${saved.id_despesa}) estornada — voltou para aberto`,
  }));

  return res.json(saved);
});
