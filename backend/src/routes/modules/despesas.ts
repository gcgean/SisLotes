import { Response, Router } from "express";
import { z } from "zod";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { PlanoDeContas } from "../../entities/PlanoDeContas";
import { Fornecedor } from "../../entities/Fornecedor";
import { Despesa } from "../../entities/Despesa";
import { DespesaParcela } from "../../entities/DespesaParcela";
import { DespesaRateio } from "../../entities/DespesaRateio";
import { Log } from "../../entities/Log";
import { AuthRequest, requireAuth, requireFeature, requirePermission } from "../../middleware/auth";
import { diferencaDiasCivis } from "../../utils/date-only";
import { AuditoriaService } from "../../services/AuditoriaService";
import { contaContabilAceitaLancamento } from "../../utils/plano-contas";
import { verificarPeriodoFinanceiro, verificarPermissaoRetroativa } from "../../services/PeriodoFinanceiroService";
import { anexoFinanceiroSchema } from "../../utils/anexo-financeiro";

export const despesasRouter = Router();
despesasRouter.use(requireAuth, requireFeature("module_despesas"));
despesasRouter.post(/\/(?:parcelas|parcela-pagamentos)\/\d+\/estornar$/, requirePermission("financeiro_estornar"));

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
  await AuditoriaService.registrar(req, "plano_de_contas", "CREATE", saved.id_conta_contabil, undefined, { codigo: saved.codigo, nome: saved.nome, tipo: saved.tipo, id_pai: saved.id_pai, ativo: saved.ativo }, `Conta contábil criada — ${saved.codigo} ${saved.nome}`);
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
  const valoresAntigos = { nome: conta.nome, ativo: conta.ativo };

  Object.assign(conta, parse.data);
  const saved = await repo.save(conta);
  await AuditoriaService.registrar(req, "plano_de_contas", "UPDATE", saved.id_conta_contabil, valoresAntigos, { nome: saved.nome, ativo: saved.ativo }, `Conta contábil editada — ${saved.codigo} ${saved.nome}`);
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
  await AuditoriaService.registrar(req, "plano_de_contas", "DELETE", Number(req.params.id), { codigo: conta.codigo, nome: conta.nome, tipo: conta.tipo, ativo: conta.ativo }, undefined, `Conta contábil excluída — ${conta.codigo} ${conta.nome}`);
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
  await AuditoriaService.registrar(req, "fornecedores", "CREATE", saved.id_fornecedor, undefined, { nome: saved.nome, documento: saved.documento, ativo: saved.ativo }, `Fornecedor criado — ${saved.nome}`);
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
  const valoresAntigos = { nome: fornecedor.nome, documento: fornecedor.documento, ativo: fornecedor.ativo };

  Object.assign(fornecedor, parse.data);
  const saved = await repo.save(fornecedor);
  await AuditoriaService.registrar(req, "fornecedores", "UPDATE", saved.id_fornecedor, valoresAntigos, { nome: saved.nome, documento: saved.documento, ativo: saved.ativo }, `Fornecedor editado — ${saved.nome}`);
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
  const ativoAnterior = fornecedor.ativo;

  fornecedor.ativo = ativo;
  const saved = await repo.save(fornecedor);
  await AuditoriaService.registrar(req, "fornecedores", "UPDATE", saved.id_fornecedor, { ativo: ativoAnterior }, { ativo: saved.ativo }, `${saved.ativo ? "Fornecedor ativado" : "Fornecedor desativado"} — ${saved.nome}`);
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
  await AuditoriaService.registrar(req, "fornecedores", "DELETE", Number(req.params.id), { nome: fornecedor.nome, documento: fornecedor.documento, ativo: fornecedor.ativo }, undefined, `Fornecedor excluído — ${fornecedor.nome}`);
  return res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
//  Despesas + parcelas
// ═══════════════════════════════════════════════════════════════════════════

export function addMonths(dateStr: string, months: number): string {
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

const rateioItemSchema = z.object({
  id_loteamento: z.number().int().positive(),
  percentual: z.number().positive().max(100),
});

const despesaBodyObjectSchema = z.object({
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
  // Conta recorrente: gera 1 nova parcela por mês automaticamente. Só pode ser
  // definida na criação — usar PATCH /:id/recorrencia para pausar/retomar depois.
  recorrente: z.boolean().optional().default(false),
  // Rateio entre loteamentos (ex: energia que atende mais de um empreendimento).
  // Quando informado, "id_loteamento" deve ficar vazio e a soma dos percentuais = 100.
  rateio: z.array(rateioItemSchema).optional(),
});

const despesaBodySchema = despesaBodyObjectSchema
  .refine((d) => !d.recorrente || d.numero_parcelas === 1, {
    message: "Contas recorrentes devem iniciar com 1 parcela — as próximas são geradas automaticamente todo mês.",
    path: ["numero_parcelas"],
  })
  .refine((d) => !d.rateio || d.rateio.length === 0 || d.id_loteamento == null, {
    message: 'Ao ratear entre loteamentos, deixe o campo "Loteamento" em branco.',
    path: ["id_loteamento"],
  })
  .refine(
    (d) => {
      if (!d.rateio || d.rateio.length === 0) return true;
      const soma = d.rateio.reduce((s, r) => s + r.percentual, 0);
      return Math.abs(soma - 100) < 0.5;
    },
    { message: "A soma dos percentuais do rateio deve ser 100%.", path: ["rateio"] },
  );

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
         d.anexo_nome, d.created_at, d.updated_at, d.recorrente, d.recorrencia_ativa,
         lo.nome AS loteamento_nome,
         c.nome AS categoria_nome, COALESCE(cg.nome, c.nome) AS categoria_grupo,
         f.nome AS fornecedor_nome,
         COALESCE(pc.parcelas_pagas, 0)::int AS parcelas_pagas,
         COALESCE(pc.parcelas_total, d.numero_parcelas)::int AS parcelas_total,
         COALESCE(pc.valor_pago, 0)::numeric AS valor_pago,
         COALESCE(rt.rateado_qtd, 0)::int AS rateado_qtd,
         COALESCE(prox.vencimento, pc.ultimo_vencimento) AS vencimento,
         prox.id_despesa_parcela AS proxima_parcela_id,
         prox.valor AS proxima_parcela_valor
       FROM despesas d
       LEFT JOIN loteamentos lo ON lo.id_loteamento = d.id_loteamento
       LEFT JOIN plano_de_contas c ON c.id_conta_contabil = d.id_categoria
       LEFT JOIN plano_de_contas cg ON cg.id_conta_contabil = c.id_pai
       LEFT JOIN fornecedores f ON f.id_fornecedor = d.id_fornecedor
       LEFT JOIN (
         SELECT id_despesa,
                COUNT(*) FILTER (WHERE situacao = 'pago') AS parcelas_pagas,
                COUNT(*) AS parcelas_total,
                SUM(valor_pago) FILTER (WHERE situacao = 'pago') AS valor_pago,
                MAX(vencimento) AS ultimo_vencimento
         FROM despesa_parcelas
         GROUP BY id_despesa
       ) pc ON pc.id_despesa = d.id_despesa
       LEFT JOIN LATERAL (
         SELECT dp.id_despesa_parcela, dp.vencimento, dp.valor
         FROM despesa_parcelas dp
         WHERE dp.id_despesa = d.id_despesa AND dp.situacao = 'aberto'
         ORDER BY dp.vencimento ASC
         LIMIT 1
       ) prox ON true
       LEFT JOIN (
         SELECT id_despesa, COUNT(*) AS rateado_qtd FROM despesa_rateio GROUP BY id_despesa
       ) rt ON rt.id_despesa = d.id_despesa
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

// ─── GET /alertas — parcelas em aberto atrasadas, vencendo hoje e no mês ──────
// IMPORTANTE: precisa vir antes de "GET /:id" para não ser interpretada como id.
despesasRouter.get("/alertas", async (req: AuthRequest, res: Response) => {
  const idEmpresa = req.user!.id_empresa;

  try {
    const rows = await AppDataSource.query(
      `SELECT
         p.id_despesa_parcela, p.id_despesa, p.numero_parcela,
         TO_CHAR(p.vencimento, 'YYYY-MM-DD') AS vencimento, (p.valor-COALESCE((SELECT SUM(pp.valor_principal+pp.desconto) FROM despesa_parcela_pagamentos pp WHERE pp.id_despesa_parcela=p.id_despesa_parcela),0)) AS valor,
         d.descricao,
         lo.nome AS loteamento_nome
       FROM despesa_parcelas p
       JOIN despesas d ON d.id_despesa = p.id_despesa
       LEFT JOIN loteamentos lo ON lo.id_loteamento = d.id_loteamento
       WHERE p.id_empresa = $1
         AND p.situacao <> 'pago'
         AND p.vencimento <= (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date
       ORDER BY p.vencimento ASC`,
      [idEmpresa]
    );

    type Row = {
      id_despesa_parcela: number;
      id_despesa: number;
      numero_parcela: number;
      vencimento: string;
      valor: string;
      descricao: string;
      loteamento_nome: string | null;
    };

    const hojeRows = await AppDataSource.query(`SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS hoje`);
    const hojeStr = String(hojeRows[0]?.hoje);
    const mesAtual = hojeStr.slice(0, 7);
    const atrasadas: Row[] = [];
    const hoje: Row[] = [];
    const mes: Row[] = [];

    for (const r of rows as Row[]) {
      if (r.vencimento < hojeStr) atrasadas.push(r);
      else if (r.vencimento === hojeStr) hoje.push(r);
      else if (r.vencimento.startsWith(mesAtual)) mes.push(r);
    }

    const somaValor = (arr: Row[]) => arr.reduce((s, r) => s + Number(r.valor), 0);
    const mapItem = (r: Row) => ({
      id_despesa_parcela: r.id_despesa_parcela,
      id_despesa: r.id_despesa,
      descricao: r.descricao,
      loteamento_nome: r.loteamento_nome,
      vencimento: r.vencimento,
      valor: Number(r.valor),
      diasAtraso: Math.max(0, diferencaDiasCivis(r.vencimento, hojeStr)),
    });

    return res.json({
      atrasadas: { qtd: atrasadas.length, valor: somaValor(atrasadas), itens: atrasadas.slice(0, 8).map(mapItem) },
      hoje: { qtd: hoje.length, valor: somaValor(hoje), itens: hoje.slice(0, 8).map(mapItem) },
      mes: { qtd: mes.length, valor: somaValor(mes), itens: mes.slice(0, 8).map(mapItem) },
    });
  } catch (error) {
    console.error("Erro ao buscar alertas de contas a pagar:", error);
    return res.status(500).json({ error: "Erro ao buscar alertas" });
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

  const rateio = await AppDataSource.query(
    `SELECT r.id_loteamento, r.percentual, lo.nome AS loteamento_nome
     FROM despesa_rateio r
     JOIN loteamentos lo ON lo.id_loteamento = r.id_loteamento
     WHERE r.id_despesa = $1
     ORDER BY r.percentual DESC`,
    [despesa.id_despesa]
  );
  const baixas=await AppDataSource.query(`SELECT pp.*,c.apelido AS conta_apelido FROM despesa_parcela_pagamentos pp JOIN contas c ON c.id_conta=pp.id_conta WHERE pp.id_empresa=$1 AND pp.id_despesa_parcela=ANY($2::int[]) ORDER BY pp.pago_data,pp.id_parcela_pagamento`,[idEmpresa,parcelas.map(p=>p.id_despesa_parcela)]);
  const baixasPorParcela=new Map<number,unknown[]>();for(const b of baixas){const lista=baixasPorParcela.get(b.id_despesa_parcela)??[];lista.push(b);baixasPorParcela.set(b.id_despesa_parcela,lista);}

  return res.json({ ...despesa, parcelas:parcelas.map(p=>({...p,pagamentos:baixasPorParcela.get(p.id_despesa_parcela)??[]})), rateio });
});

// ─── POST / — cria despesa + gera parcelas ────────────────────────────────────
despesasRouter.post("/", async (req: AuthRequest, res: Response) => {
  const parse = despesaBodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const data = parse.data;
  const idEmpresa = req.user!.id_empresa;
  if (!(await contaContabilAceitaLancamento(data.id_categoria, idEmpresa, "despesa"))) {
    return res.status(400).json({ error: "Selecione uma conta contábil analítica de despesa. Contas com subcontas não aceitam lançamentos." });
  }
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
    recorrente: data.recorrente,
    recorrencia_ativa: true,
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

  if (data.rateio && data.rateio.length > 0) {
    const rateioRepo = AppDataSource.getRepository(DespesaRateio);
    await rateioRepo.save(
      data.rateio.map((r) =>
        rateioRepo.create({
          id_empresa: idEmpresa,
          id_despesa: despesaSalva.id_despesa,
          id_loteamento: r.id_loteamento,
          percentual: r.percentual.toFixed(2),
        })
      )
    );
  }
  await AuditoriaService.registrar(req, "despesas", "CREATE", despesaSalva.id_despesa, undefined, {
    descricao: despesaSalva.descricao, valor_total: despesaSalva.valor_total, numero_parcelas: despesaSalva.numero_parcelas,
    id_loteamento: despesaSalva.id_loteamento, id_categoria: despesaSalva.id_categoria, id_fornecedor: despesaSalva.id_fornecedor,
  }, `Conta a pagar criada — ${despesaSalva.descricao}, valor ${despesaSalva.valor_total}`);

  return res.status(201).json({ ...despesaSalva, parcelas });
});

// ─── PUT /:id — edita cabeçalho (bloqueia se já houver parcela paga) ──────────
despesasRouter.put("/:id", async (req: AuthRequest, res: Response) => {
  const parse = despesaBodyObjectSchema
    .omit({ numero_parcelas: true, data_primeiro_vencimento: true, recorrente: true })
    .partial()
    .safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const despesaRepo = AppDataSource.getRepository(Despesa);
  const despesa = await despesaRepo.findOne({
    where: { id_despesa: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!despesa) return res.status(404).json({ error: "Despesa não encontrada" });
  const valoresAntigos = { descricao: despesa.descricao, valor_total: despesa.valor_total, id_loteamento: despesa.id_loteamento, id_categoria: despesa.id_categoria, id_fornecedor: despesa.id_fornecedor };

  const parcelaRepo = AppDataSource.getRepository(DespesaParcela);
  const parcelaPaga = await parcelaRepo.count({
    where: { id_despesa: despesa.id_despesa, id_empresa: req.user!.id_empresa, situacao: "pago" },
  });
  if (parcelaPaga > 0) {
    return res.status(409).json({ error: "Despesa já tem parcela paga — não é possível editar os valores." });
  }

  const { valor_total, rateio, ...rest } = parse.data;

  if (rest.id_categoria !== undefined && !(await contaContabilAceitaLancamento(rest.id_categoria, req.user!.id_empresa, "despesa"))) {
    return res.status(400).json({ error: "Selecione uma conta contábil analítica de despesa. Contas com subcontas não aceitam lançamentos." });
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

  Object.assign(despesa, rest);
  if (valor_total != null) despesa.valor_total = valor_total.toFixed(2);
  const saved = await despesaRepo.save(despesa);

  if (rateio !== undefined) {
    const rateioRepo = AppDataSource.getRepository(DespesaRateio);
    await rateioRepo.delete({ id_despesa: despesa.id_despesa });
    if (rateio.length > 0) {
      await rateioRepo.save(
        rateio.map((r) =>
          rateioRepo.create({
            id_empresa: req.user!.id_empresa,
            id_despesa: despesa.id_despesa,
            id_loteamento: r.id_loteamento,
            percentual: r.percentual.toFixed(2),
          })
        )
      );
    }
  }
  await AuditoriaService.registrar(req, "despesas", "UPDATE", saved.id_despesa, valoresAntigos, {
    descricao: saved.descricao, valor_total: saved.valor_total, id_loteamento: saved.id_loteamento, id_categoria: saved.id_categoria, id_fornecedor: saved.id_fornecedor,
  }, `Conta a pagar editada — ${saved.descricao}`);

  return res.json(saved);
});

// ─── DELETE /:id — bloqueia se houver parcela paga ────────────────────────────
despesasRouter.delete("/:id", requirePermission("financeiro_excluir"), async (req: AuthRequest, res: Response) => {
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
  await AuditoriaService.registrar(req, "despesas", "DELETE", Number(req.params.id), {
    descricao: despesa.descricao, valor_total: despesa.valor_total, numero_parcelas: despesa.numero_parcelas, id_loteamento: despesa.id_loteamento,
  }, undefined, `Conta a pagar excluída — ${despesa.descricao}, valor ${despesa.valor_total}`);
  return res.status(204).send();
});

// ─── PATCH /:id/recorrencia — ativar/pausar a geração automática mensal ───────
const recorrenciaBodySchema = z.object({ recorrencia_ativa: z.boolean() });

despesasRouter.patch("/:id/recorrencia", async (req: AuthRequest, res: Response) => {
  const parse = recorrenciaBodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const despesaRepo = AppDataSource.getRepository(Despesa);
  const despesa = await despesaRepo.findOne({
    where: { id_despesa: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!despesa) return res.status(404).json({ error: "Despesa não encontrada" });
  if (!despesa.recorrente) {
    return res.status(400).json({ error: "Esta conta não é recorrente." });
  }

  despesa.recorrencia_ativa = parse.data.recorrencia_ativa;
  const saved = await despesaRepo.save(despesa);
  await AuditoriaService.registrar(req, "despesas", "UPDATE", saved.id_despesa, { recorrencia_ativa: !saved.recorrencia_ativa }, { recorrencia_ativa: saved.recorrencia_ativa }, `${saved.recorrencia_ativa ? "Recorrência ativada" : "Recorrência pausada"} — ${saved.descricao}`);

  return res.json({ id_despesa: saved.id_despesa, recorrencia_ativa: saved.recorrencia_ativa });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Parcelas — pagar / estornar (espelha pagamentos.ts)
// ═══════════════════════════════════════════════════════════════════════════

const pagarSchema = z.object({
  pago_data: z.string(),
  valor_pago: z.number().positive().optional(),
  valor_base: z.number().positive().optional(),
  multa: z.number().min(0).default(0),
  juros: z.number().min(0).default(0),
  desconto: z.number().min(0).default(0),
  // Obrigatório: precisa informar de qual conta saiu o pagamento para que o
  // extrato da conta reflita as contas a pagar quitadas.
  id_conta: z.number().int().positive({ message: "Informe a conta de onde saiu o pagamento." }),
}).and(anexoFinanceiroSchema);

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
  const valoresAntigos = { situacao: parcela.situacao, pago_data: parcela.pago_data, valor_pago: parcela.valor_pago, id_conta: parcela.id_conta };

  const { pago_data, id_conta, multa, juros, desconto, anexo_nome, anexo_base64 } = parse.data;
  const bloqueio=await verificarPeriodoFinanceiro(req.user!.id_empresa,pago_data);if(bloqueio)return res.status(409).json({error:bloqueio});
  const retroativo=await verificarPermissaoRetroativa(req.user!,pago_data);if(retroativo)return res.status(403).json({error:retroativo});
  const valorBase = parse.data.valor_base ?? parse.data.valor_pago ?? Number(parcela.valor);
  const valorPago = valorBase + multa + juros - desconto;
  if (valorPago <= 0 || desconto > valorBase + multa + juros) return res.status(400).json({ error: "O total efetivamente pago deve ser maior que zero." });
  const [somaAtual] = await AppDataSource.query(`SELECT COALESCE(SUM(valor_principal+desconto),0)::numeric AS liquidado,COALESCE(SUM(valor_pago),0)::numeric AS pago,COALESCE(SUM(multa),0)::numeric AS multa,COALESCE(SUM(juros),0)::numeric AS juros,COALESCE(SUM(desconto),0)::numeric AS desconto FROM despesa_parcela_pagamentos WHERE id_despesa_parcela=$1`,[parcela.id_despesa_parcela]);
  if(Number(somaAtual.liquidado)+valorBase+desconto>Number(parcela.valor)+0.01)return res.status(400).json({error:"O valor principal e o desconto excedem o saldo restante da parcela."});
  parcela.situacao = Number(somaAtual.liquidado)+valorBase+desconto>=Number(parcela.valor)-0.01?"pago":"parcial";
  parcela.pago_data = pago_data;
  parcela.valor_pago = (Number(somaAtual.pago)+valorPago).toFixed(2);
  parcela.multa_paga = (Number(somaAtual.multa)+multa).toFixed(2);
  parcela.juros_pagos = (Number(somaAtual.juros)+juros).toFixed(2);
  parcela.desconto_obtido = (Number(somaAtual.desconto)+desconto).toFixed(2);
  parcela.id_conta = id_conta ?? null;
  parcela.id_usuario = req.user!.id_usuario;

  const saved = await AppDataSource.transaction(async manager=>{const atualizada=await manager.save(parcela);await manager.query(`INSERT INTO despesa_parcela_pagamentos(id_empresa,id_despesa_parcela,id_conta,pago_data,valor_principal,multa,juros,desconto,valor_pago,id_usuario,anexo_nome,anexo_base64) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[atualizada.id_empresa,atualizada.id_despesa_parcela,id_conta,pago_data,valorBase,multa,juros,desconto,valorPago,req.user!.id_usuario,anexo_nome??null,anexo_base64??null]);return atualizada;});

  const logRepo = AppDataSource.getRepository(Log);
  await logRepo.save(logRepo.create({
    id_usuario: req.user!.id_usuario,
    servico: "despesa_parcela_pagar",
    url: `/api/despesas/parcelas/${req.params.id}/pagar`,
    log: `Parcela de despesa ${saved.id_despesa_parcela} (despesa ${saved.id_despesa}) paga — valor_pago=${saved.valor_pago}`,
    query: JSON.stringify(parse.data),
  }));
  await AuditoriaService.registrar(req, "despesa_parcelas", "UPDATE", saved.id_despesa_parcela, valoresAntigos, { situacao: saved.situacao, pago_data: saved.pago_data, valor_pago: saved.valor_pago, multa_paga: saved.multa_paga, juros_pagos: saved.juros_pagos, desconto_obtido: saved.desconto_obtido, id_conta: saved.id_conta }, `Pagamento confirmado — despesa ${saved.id_despesa}, parcela ${saved.numero_parcela}, valor ${saved.valor_pago}`);

  return res.json(saved);
});

// ─── POST /parcelas/pagar-lote — paga várias parcelas de uma vez ─────────────
const pagarLoteSchema = z.object({
  pago_data: z.string(),
  id_conta: z.number().int().positive({ message: "Informe a conta de onde saiu o pagamento." }),
  itens: z
    .array(
      z.object({
        id_despesa_parcela: z.number().int().positive(),
        valor_pago: z.number().positive(),
        multa: z.number().min(0).default(0), juros: z.number().min(0).default(0), desconto: z.number().min(0).default(0),
      })
    )
    .min(1)
    .max(200),
});

despesasRouter.post("/parcelas/pagar-lote", async (req: AuthRequest, res: Response) => {
  const parse = pagarLoteSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const { pago_data, id_conta, itens } = parse.data;
  const bloqueio=await verificarPeriodoFinanceiro(req.user!.id_empresa,pago_data);if(bloqueio)return res.status(409).json({error:bloqueio});
  const retroativo=await verificarPermissaoRetroativa(req.user!,pago_data);if(retroativo)return res.status(403).json({error:retroativo});
  const idEmpresa = req.user!.id_empresa;
  const repo = AppDataSource.getRepository(DespesaParcela);
  const logRepo = AppDataSource.getRepository(Log);

  let pagas = 0;
  const ignoradas: Array<{ id_despesa_parcela: number; motivo: string }> = [];

  for (const item of itens) {
    const parcela = await repo.findOne({
      where: { id_despesa_parcela: item.id_despesa_parcela, id_empresa: idEmpresa },
    });
    if (!parcela) {
      ignoradas.push({ id_despesa_parcela: item.id_despesa_parcela, motivo: "Parcela não encontrada" });
      continue;
    }
    if (parcela.situacao === "pago") {
      ignoradas.push({ id_despesa_parcela: item.id_despesa_parcela, motivo: "Já estava paga" });
      continue;
    }

    parcela.situacao = "pago";
    parcela.pago_data = pago_data;
    const totalPago = item.valor_pago + item.multa + item.juros - item.desconto;
    if (totalPago <= 0) { ignoradas.push({ id_despesa_parcela: item.id_despesa_parcela, motivo: "Total inválido" }); continue; }
    parcela.valor_pago = totalPago.toFixed(2);
    parcela.multa_paga = item.multa.toFixed(2); parcela.juros_pagos = item.juros.toFixed(2); parcela.desconto_obtido = item.desconto.toFixed(2);
    parcela.id_conta = id_conta;
    parcela.id_usuario = req.user!.id_usuario;
    await AppDataSource.transaction(async manager=>{await manager.save(parcela);await manager.query(`INSERT INTO despesa_parcela_pagamentos(id_empresa,id_despesa_parcela,id_conta,pago_data,valor_principal,multa,juros,desconto,valor_pago,id_usuario) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[parcela.id_empresa,parcela.id_despesa_parcela,id_conta,pago_data,item.valor_pago,item.multa,item.juros,item.desconto,totalPago,req.user!.id_usuario]);});
    pagas++;

    await logRepo.save(logRepo.create({
      id_usuario: req.user!.id_usuario,
      servico: "despesa_parcela_pagar_lote",
      url: "/api/despesas/parcelas/pagar-lote",
      log: `Parcela de despesa ${parcela.id_despesa_parcela} (despesa ${parcela.id_despesa}) paga em lote — valor_pago=${parcela.valor_pago}`,
    }));
    await AuditoriaService.registrar(req, "despesa_parcelas", "UPDATE", parcela.id_despesa_parcela, { situacao: "aberto", pago_data: null, valor_pago: null, multa_paga: "0.00", juros_pagos: "0.00", desconto_obtido: "0.00", id_conta: null }, { situacao: parcela.situacao, pago_data: parcela.pago_data, valor_pago: parcela.valor_pago, multa_paga: parcela.multa_paga, juros_pagos: parcela.juros_pagos, desconto_obtido: parcela.desconto_obtido, id_conta: parcela.id_conta }, `Pagamento em lote confirmado — despesa ${parcela.id_despesa}, parcela ${parcela.numero_parcela}, valor ${parcela.valor_pago}`);
  }

  return res.json({ pagas, ignoradas });
});

despesasRouter.post("/parcelas/:id/estornar", requirePermission("financeiro_estornar"), async (req: AuthRequest, res: Response) => {
  const repo = AppDataSource.getRepository(DespesaParcela);
  const parcela = await repo.findOne({
    where: { id_despesa_parcela: Number(req.params.id), id_empresa: req.user!.id_empresa },
  });
  if (!parcela) return res.status(404).json({ error: "Parcela não encontrada" });
  const bloqueio=await verificarPeriodoFinanceiro(req.user!.id_empresa,parcela.pago_data);if(bloqueio)return res.status(409).json({error:bloqueio});
  if (parcela.situacao === "aberto") {
    return res.status(400).json({ error: "Esta parcela não está paga e não pode ser estornada." });
  }
  const valoresAntigos = { situacao: parcela.situacao, pago_data: parcela.pago_data, valor_pago: parcela.valor_pago, multa_paga: parcela.multa_paga, juros_pagos: parcela.juros_pagos, desconto_obtido: parcela.desconto_obtido, id_conta: parcela.id_conta };

  parcela.situacao = "aberto";
  parcela.pago_data = null;
  parcela.valor_pago = null;
  parcela.multa_paga = "0.00";
  parcela.juros_pagos = "0.00";
  parcela.desconto_obtido = "0.00";
  parcela.id_conta = null;

  const saved = await AppDataSource.transaction(async manager=>{const atualizada=await manager.save(parcela);await manager.query(`DELETE FROM despesa_parcela_pagamentos WHERE id_despesa_parcela=$1 AND id_empresa=$2`,[atualizada.id_despesa_parcela,atualizada.id_empresa]);return atualizada;});

  const logRepo = AppDataSource.getRepository(Log);
  await logRepo.save(logRepo.create({
    id_usuario: req.user!.id_usuario,
    servico: "despesa_parcela_estornar",
    url: `/api/despesas/parcelas/${req.params.id}/estornar`,
    log: `Parcela de despesa ${saved.id_despesa_parcela} (despesa ${saved.id_despesa}) estornada — voltou para aberto`,
  }));
  await AuditoriaService.registrar(req, "despesa_parcelas", "UPDATE", saved.id_despesa_parcela, valoresAntigos, { situacao: saved.situacao, pago_data: saved.pago_data, valor_pago: saved.valor_pago, id_conta: saved.id_conta }, `Pagamento estornado — despesa ${saved.id_despesa}, parcela ${saved.numero_parcela}`);

  return res.json(saved);
});

despesasRouter.post("/parcela-pagamentos/:id/estornar",async(req:AuthRequest,res:Response)=>{const id=Number(req.params.id),empresa=req.user!.id_empresa;const [existente]=await AppDataSource.query(`SELECT * FROM despesa_parcela_pagamentos WHERE id_parcela_pagamento=$1 AND id_empresa=$2`,[id,empresa]);if(!existente)return res.status(404).json({error:"Baixa não encontrada"});const bloqueio=await verificarPeriodoFinanceiro(empresa,existente.pago_data);if(bloqueio)return res.status(409).json({error:bloqueio});const [baixa]=await AppDataSource.query(`DELETE FROM despesa_parcela_pagamentos WHERE id_parcela_pagamento=$1 AND id_empresa=$2 RETURNING *`,[id,empresa]);const [s]=await AppDataSource.query(`SELECT COALESCE(SUM(valor_principal+desconto),0)::numeric liquidado,COALESCE(SUM(valor_pago),0)::numeric pago,COALESCE(SUM(multa),0)::numeric multa,COALESCE(SUM(juros),0)::numeric juros,COALESCE(SUM(desconto),0)::numeric desconto,MAX(pago_data) data FROM despesa_parcela_pagamentos WHERE id_despesa_parcela=$1`,[baixa.id_despesa_parcela]);await AppDataSource.query(`UPDATE despesa_parcelas SET situacao=CASE WHEN $2=0 THEN 'aberto' WHEN $2>=valor THEN 'pago' ELSE 'parcial' END,valor_pago=CASE WHEN $2=0 THEN NULL ELSE $3 END,multa_paga=$4,juros_pagos=$5,desconto_obtido=$6,pago_data=$7,id_conta=CASE WHEN $2=0 THEN NULL ELSE id_conta END WHERE id_despesa_parcela=$1`,[baixa.id_despesa_parcela,Number(s.liquidado),Number(s.pago),Number(s.multa),Number(s.juros),Number(s.desconto),s.data]);await AuditoriaService.registrar(req,"despesa_parcela_pagamentos","DELETE",id,baixa,undefined,"Baixa parcial estornada");return res.status(204).send();});
