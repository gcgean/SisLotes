import { Router } from "express";
import { z } from "zod";
import { Not } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { Venda } from "../../entities/Venda";
import { Cliente } from "../../entities/Cliente";
import { Lote } from "../../entities/Lote";
import { Pagamento } from "../../entities/Pagamento";
import { Log } from "../../entities/Log";
import { Despesa } from "../../entities/Despesa";
import { DespesaParcela } from "../../entities/DespesaParcela";
import { Fornecedor } from "../../entities/Fornecedor";
import { PlanoDeContas } from "../../entities/PlanoDeContas";
import { VendaAcordo } from "../../entities/VendaAcordo";
import { AuthRequest, requireAuth, requireFeature, requirePermission } from "../../middleware/auth";
import { AuditoriaService } from "../../services/AuditoriaService";

export const vendasRouter = Router();
vendasRouter.use(requireAuth, requireFeature("module_vendas"));

function normalizeIsoDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

// ─── Schema: histórico manual ──────────────────────────────────────────────────
const historicoParcelaSchema = z.object({
  numero_parcela: z.number().int().positive(),
  vencimento: z.string(),
  valor: z.number().nonnegative(),
  situacao: z.enum(["aberto", "pago"]),
  pago_data: z.string().nullable().optional(),
  valor_pago: z.number().nonnegative().nullable().optional(),
});

const createHistoricoSchema = z.object({
  id_cliente: z.number().int().positive(),
  id_lote: z.number().int().positive(),
  data_venda: z.string(),
  valor_entrada: z.number().nonnegative(),
  parcelas: z.number().int().positive(),
  valor_parcela: z.number().nonnegative(),
  pagamentos: z.array(historicoParcelaSchema),
});

const comissaoSchema = z.object({
  id_corretor: z.number().int().positive(),
  tipo: z.enum(["percentual", "valor"]),
  percentual: z.number().positive().max(100).optional(),
  valor: z.number().positive().optional(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).superRefine((comissao, ctx) => {
  if (comissao.tipo === "percentual" && !comissao.percentual) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o percentual da comissão.", path: ["percentual"] });
  if (comissao.tipo === "valor" && !comissao.valor) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o valor da comissão.", path: ["valor"] });
});

const createVendaSchema = z.object({
  id_cliente: z.number().int().positive(),
  id_lote: z.number().int().positive(),
  data_venda: z.string(),
  valor_entrada: z.number().nonnegative(),
  parcelas: z.number().int().positive(),
  valor_parcela: z.number().nonnegative(),
  comissao: comissaoSchema.optional().nullable(),
});

vendasRouter.get("/opcoes/corretores", async (req: AuthRequest, res) => {
  const corretores = await AppDataSource.getRepository(Fornecedor).find({
    where: { id_empresa: req.user!.id_empresa, ativo: true },
    order: { nome: "ASC" },
  });
  return res.json(corretores.map(({ id_fornecedor, nome, documento }) => ({ id_fornecedor, nome, documento })));
});

vendasRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const idEmpresa = req.user?.id_empresa;

  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  const query = `
    SELECT
      v.id_venda,
      c.nome AS cliente,
      CONCAT('Quadra ', l.quadra, ' - Lote ', l.lote) AS lote,
      lot.nome AS loteamento,
      TO_CHAR(v.data_venda, 'DD/MM/YYYY') AS data_venda,
      v.valor_entrada,
      v.parcelas,
      v.porcentagem,
      v.valor_parcela,
      v.status,
      v.valor_entrada + COALESCE(SUM(p.valor), 0) AS valor_total
    FROM vendas v
    JOIN clientes c ON c.id_cliente = v.id_cliente
    JOIN lotes l ON l.id_lote = v.id_lote
    JOIN loteamentos lot ON lot.id_loteamento = l.id_loteamento
    LEFT JOIN pagamentos p ON p.id_venda = v.id_venda
    WHERE v.id_empresa = $1
    GROUP BY
      v.id_venda,
      c.nome,
      l.quadra,
      l.lote,
      lot.nome,
      v.data_venda,
      v.valor_entrada,
      v.parcelas,
      v.porcentagem,
      v.valor_parcela,
      v.status
    ORDER BY v.data_venda DESC, v.id_venda DESC
  `;

  const rows = await AppDataSource.query(query, [idEmpresa]);

  type VendaRow = {
    id_venda: number | string;
    cliente: string;
    lote: string;
    loteamento: string;
    data_venda: string;
    valor_entrada: string | number;
    parcelas: number | string;
    porcentagem: string | number;
    valor_parcela: string | number | null;
    status: string;
    valor_total: string | number | null;
  };

  const resultado = (rows as VendaRow[]).map((row) => ({
    id_venda: Number(row.id_venda),
    cliente: row.cliente,
    lote: row.lote,
    loteamento: row.loteamento,
    data_venda: row.data_venda,
    valor_entrada: Number(row.valor_entrada ?? 0),
    parcelas: Number(row.parcelas ?? 0),
    porcentagem: Number(row.porcentagem ?? 0),
    valor_parcela: Number(row.valor_parcela ?? 0),
    status: row.status,
    valor_total: Number(row.valor_total ?? 0),
  }));

  return res.json(resultado);
});

vendasRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Venda);

  const where: Record<string, unknown> = { id_venda: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const venda = await repo.findOne({
    where,
    relations: ["pagamentos", "cliente", "lote", "lote.loteamento"],
  });

  if (!venda) {
    return res.status(404).json({ error: "Venda não encontrada" });
  }

  const acordos = await AppDataSource.getRepository(VendaAcordo).find({ where: { id_venda: venda.id_venda, id_empresa: venda.id_empresa }, order: { created_at: "DESC" } });
  return res.json({ ...venda, acordos });
});

vendasRouter.post("/", requireAuth, requirePermission("vendas_cadastrar"), async (req: AuthRequest, res) => {
  const parseResult = createVendaSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const { id_cliente, id_lote, data_venda, valor_entrada, parcelas, valor_parcela, comissao } = parseResult.data;
  const dataVendaIso = normalizeIsoDate(data_venda);

  if (!dataVendaIso) {
    return res.status(400).json({ error: "Data de venda inválida. Use o formato YYYY-MM-DD." });
  }

  const user = req.user;

  if (valor_parcela <= 0) {
    return res.status(400).json({ error: "O valor da parcela deve ser maior que zero" });
  }

  const clienteRepo = AppDataSource.getRepository(Cliente);
  const loteRepo = AppDataSource.getRepository(Lote);
  const vendaRepo = AppDataSource.getRepository(Venda);
  const logRepo = AppDataSource.getRepository(Log);

  const clienteWhere: Record<string, unknown> = { id_cliente };
  if (user?.id_empresa) clienteWhere.id_empresa = user.id_empresa;
  const cliente = await clienteRepo.findOne({ where: clienteWhere });
  if (!cliente) {
    return res.status(400).json({ error: "Cliente inválido" });
  }

  const loteWhere: Record<string, unknown> = { id_lote };
  if (user?.id_empresa) loteWhere.id_empresa = user.id_empresa;
  const lote = await loteRepo.findOne({ where: loteWhere });
  if (!lote) {
    return res.status(400).json({ error: "Lote inválido" });
  }

  let corretor: Fornecedor | null = null;
  let categoriaComissao: PlanoDeContas | null = null;
  if (comissao) {
    [corretor, categoriaComissao] = await Promise.all([
      AppDataSource.getRepository(Fornecedor).findOne({ where: { id_fornecedor: comissao.id_corretor, id_empresa: user?.id_empresa ?? 1, ativo: true } }),
      AppDataSource.getRepository(PlanoDeContas).findOne({ where: { id_empresa: user?.id_empresa ?? 1, tipo: "despesa", nome: "Comissão de Corretor", ativo: true } }),
    ]);
    if (!corretor) return res.status(400).json({ error: "Selecione um corretor ativo cadastrado como fornecedor." });
    if (!categoriaComissao) return res.status(409).json({ error: "A conta contábil Comissão de Corretor não está disponível." });
  }

  const existingVendaWhere: Record<string, unknown> = {
    id_lote,
    status: Not("cancelada"),
  };
  if (user?.id_empresa) existingVendaWhere.id_empresa = user.id_empresa;
  const existingVenda = await vendaRepo.findOne({ where: existingVendaWhere });
  if (existingVenda) {
    return res.status(409).json({
      error: "lote_ja_vendido",
      message: "Este lote já possui uma venda ativa. Deseja cancelar a venda anterior?",
      venda_existente: {
        id_venda: existingVenda.id_venda,
        id_cliente: existingVenda.id_cliente,
        status: existingVenda.status
      }
    });
  }

  const valorParcela = Math.round(valor_parcela * 100) / 100;
  const totalParcelado = parcelas * valorParcela;
  const totalContrato = valor_entrada + totalParcelado;
  const valorComissao = comissao
    ? Math.round((comissao.tipo === "percentual" ? totalContrato * (comissao.percentual! / 100) : comissao.valor!) * 100) / 100
    : 0;

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const venda = queryRunner.manager.create(Venda, {
      id_cliente,
      id_lote,
      data_venda: dataVendaIso,
      valor_entrada: valor_entrada.toFixed(2),
      parcelas,
      porcentagem: "0.00",
      salario_minimo_base: null,
      valor_parcela: valorParcela.toFixed(2),
      status: "aberta",
      id_empresa: user?.id_empresa ?? 1,
      id_corretor: comissao?.id_corretor ?? null,
      comissao_percentual: comissao?.tipo === "percentual" ? comissao.percentual!.toFixed(4) : null,
      comissao_valor: comissao ? valorComissao.toFixed(2) : null,
      comissao_vencimento: comissao?.vencimento ?? null,
    });

    const savedVenda = await queryRunner.manager.save(venda);

    const pagamentos: Pagamento[] = [];

    // Parcela 0 = entrada (já paga na data da venda)
    if (valor_entrada > 0) {
      const entradaPagamento = queryRunner.manager.create(Pagamento, {
        id_venda: savedVenda.id_venda,
        numero_parcela: 0,
        tipo: "entrada",
        situacao: "pago",
        vencimento: dataVendaIso,
        valor: valor_entrada.toFixed(2),
        pago_data: dataVendaIso,
        valor_pago: valor_entrada.toFixed(2),
        multa: "0.00",
        juros: "0.00",
        id_empresa: user?.id_empresa ?? 1,
        id_usuario: user?.id_usuario ?? null,
      });
      pagamentos.push(entradaPagamento);
    }

    for (let i = 1; i <= parcelas; i++) {
      const baseDate = new Date(dataVendaIso + "T12:00:00");
      const vencimentoDate = new Date(baseDate);
      vencimentoDate.setMonth(vencimentoDate.getMonth() + i);
      const vencimento = vencimentoDate.toISOString().slice(0, 10);

      const pagamento = queryRunner.manager.create(Pagamento, {
        id_venda: savedVenda.id_venda,
        numero_parcela: i,
        tipo: "boleto",
        situacao: "aberto",
        vencimento,
        valor: valorParcela.toFixed(2),
        multa: "0.00",
        juros: "0.00",
        id_empresa: user?.id_empresa ?? 1,
      });

      pagamentos.push(pagamento);
    }

    await queryRunner.manager.save(pagamentos);

    if (comissao && corretor && categoriaComissao) {
      const despesaComissao = await queryRunner.manager.save(queryRunner.manager.create(Despesa, {
        id_empresa: user?.id_empresa ?? 1,
        id_loteamento: lote.id_loteamento,
        id_categoria: categoriaComissao.id_conta_contabil,
        id_fornecedor: corretor.id_fornecedor,
        id_venda_origem: savedVenda.id_venda,
        descricao: `Comissão de corretor — venda #${savedVenda.id_venda}`,
        valor_total: valorComissao.toFixed(2),
        numero_parcelas: 1,
        recorrente: false,
        recorrencia_ativa: false,
        observacoes: `Gerada automaticamente para ${corretor.nome}.`,
      }));
      await queryRunner.manager.save(queryRunner.manager.create(DespesaParcela, {
        id_empresa: user?.id_empresa ?? 1,
        id_despesa: despesaComissao.id_despesa,
        numero_parcela: 1,
        vencimento: comissao.vencimento,
        valor: valorComissao.toFixed(2),
        situacao: "aberto",
      }));
    }

    const log = queryRunner.manager.create(Log, {
      id_usuario: user?.id_usuario ?? 1,
      id_cliente,
      id_lote,
      servico: "venda_criada",
      url: "/api/vendas",
      log: `Venda ${savedVenda.id_venda} criada com ${parcelas} parcelas de R$ ${valorParcela.toFixed(2)} (modelo por valor de parcela).`,
      query: JSON.stringify(parseResult.data),
    });

    await queryRunner.manager.save(log);

    await queryRunner.commitTransaction();

    const vendaCompleta = await vendaRepo.findOne({
      where: { id_venda: savedVenda.id_venda, id_empresa: user?.id_empresa ?? 1 },
      relations: ["pagamentos", "cliente", "lote", "lote.loteamento"],
    });

    // Registrar auditoria
    await AuditoriaService.registrarVenda(
      req,
      "CREATE",
      savedVenda.id_venda,
      `Venda criada com ${parcelas} parcelas de R$ ${valorParcela.toFixed(2)}. Total parcelado: R$ ${totalParcelado.toFixed(2)}`,
      { id_cliente, id_lote, valor_entrada, parcelas, valor_parcela: valorParcela, salario_minimo_base: null, porcentagem: 0 }
    );

    return res.status(201).json(vendaCompleta);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("[POST /api/vendas] Erro:", error);
    const detail = error instanceof Error ? error.message : "Erro interno";
    return res.status(500).json({
      error: "Erro ao criar venda",
      detail,
    });
  } finally {
    await queryRunner.release();
  }
});

// ─── POST /historico — Lançamento manual de histórico ─────────────────────────
vendasRouter.post("/historico", requireAuth, requirePermission("vendas_cadastrar"), async (req: AuthRequest, res) => {
  const parseResult = createHistoricoSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const { id_cliente, id_lote, data_venda, valor_entrada, parcelas, valor_parcela, pagamentos: pagamentosInput } = parseResult.data;
  const dataVendaIso = normalizeIsoDate(data_venda);
  if (!dataVendaIso) {
    return res.status(400).json({ error: "Data de venda inválida. Use o formato YYYY-MM-DD." });
  }
  const user = req.user;

  const clienteRepo = AppDataSource.getRepository(Cliente);
  const loteRepo = AppDataSource.getRepository(Lote);
  const vendaRepo = AppDataSource.getRepository(Venda);

  const clienteWhere: Record<string, unknown> = { id_cliente };
  if (user?.id_empresa) clienteWhere.id_empresa = user.id_empresa;
  const cliente = await clienteRepo.findOne({ where: clienteWhere });
  if (!cliente) return res.status(400).json({ error: "Cliente inválido" });

  const loteWhere: Record<string, unknown> = { id_lote };
  if (user?.id_empresa) loteWhere.id_empresa = user.id_empresa;
  const lote = await loteRepo.findOne({ where: loteWhere });
  if (!lote) return res.status(400).json({ error: "Lote inválido" });

  const existingVendaWhere: Record<string, unknown> = {
    id_lote,
    status: Not("cancelada"),
  };
  if (user?.id_empresa) existingVendaWhere.id_empresa = user.id_empresa;
  const existingVenda = await vendaRepo.findOne({ where: existingVendaWhere });
  if (existingVenda) {
    return res.status(409).json({
      error: "lote_ja_vendido",
      message: "Este lote já possui uma venda ativa. Deseja cancelar a venda anterior?",
      venda_existente: { id_venda: existingVenda.id_venda, id_cliente: existingVenda.id_cliente, status: existingVenda.status },
    });
  }

  if (pagamentosInput.length !== parcelas) {
    return res.status(400).json({ error: `Número de parcelas informado (${parcelas}) não corresponde aos pagamentos enviados (${pagamentosInput.length})` });
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const venda = queryRunner.manager.create(Venda, {
      id_cliente,
      id_lote,
      data_venda: dataVendaIso,
      valor_entrada: valor_entrada.toFixed(2),
      parcelas,
      porcentagem: "0.00",
      salario_minimo_base: null,
      valor_parcela: valor_parcela.toFixed(2),
      status: "aberta",
      id_empresa: user?.id_empresa ?? 1,
    });

    const savedVenda = await queryRunner.manager.save(venda);

    const pagamentosToSave: Pagamento[] = [];

    for (const p of pagamentosInput) {
      const pagamento = queryRunner.manager.create(Pagamento, {
        id_venda: savedVenda.id_venda,
        numero_parcela: p.numero_parcela,
        tipo: "boleto",
        situacao: p.situacao,
        vencimento: p.vencimento,
        valor: p.valor.toFixed(2),
        pago_data: p.situacao === "pago" && p.pago_data ? p.pago_data : null,
        valor_pago: p.situacao === "pago" && p.valor_pago != null ? p.valor_pago.toFixed(2) : null,
        multa: "0.00",
        juros: "0.00",
        id_empresa: user?.id_empresa ?? 1,
        id_usuario: p.situacao === "pago" ? (user?.id_usuario ?? null) : null,
      });
      pagamentosToSave.push(pagamento);
    }

    await queryRunner.manager.save(pagamentosToSave);
    await queryRunner.commitTransaction();

    const vendaCompleta = await vendaRepo.findOne({
      where: { id_venda: savedVenda.id_venda, id_empresa: user?.id_empresa ?? 1 },
      relations: ["pagamentos", "cliente", "lote", "lote.loteamento"],
    });

    await AuditoriaService.registrarVenda(
      req,
      "CREATE",
      savedVenda.id_venda,
      `Histórico lançado manualmente: ${parcelas} parcelas de R$ ${valor_parcela.toFixed(2)}. Parcelas pagas: ${pagamentosInput.filter((p) => p.situacao === "pago").length}`,
      { id_cliente, id_lote, valor_entrada, parcelas, valor_parcela, historico: true }
    );

    return res.status(201).json(vendaCompleta);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("[POST /api/vendas/historico] Erro:", error);
    return res.status(500).json({ error: "Erro ao lançar histórico" });
  } finally {
    await queryRunner.release();
  }
});

// ─── PATCH /:id/editar — Edição segura (bloqueia se há parcelas pagas) ─────────
vendasRouter.patch("/:id/editar", requireAuth, requirePermission("vendas_alterar"), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const schema = z.object({
    data_venda: z.string().optional(),
    valor_entrada: z.number().nonnegative().optional(),
    parcelas: z.number().int().positive().optional(),
    valor_parcela: z.number().positive().optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

  const id_empresa = req.user?.id_empresa;
  const vendaRepo = AppDataSource.getRepository(Venda);
  const pagRepo = AppDataSource.getRepository(Pagamento);

  const whereVenda: Record<string, unknown> = { id_venda: Number(id) };
  if (id_empresa) whereVenda.id_empresa = id_empresa;
  const venda = await vendaRepo.findOne({ where: whereVenda });
  if (!venda) return res.status(404).json({ error: "Venda não encontrada" });
  if (venda.status !== "aberta") {
    return res.status(400).json({ error: "Apenas vendas com status 'aberta' podem ser editadas." });
  }

  // Bloqueia se existir qualquer parcela mensal (numero_parcela > 0) já paga
  const pagPagosQb = pagRepo
    .createQueryBuilder("p")
    .where("p.id_venda = :id_venda", { id_venda: Number(id) })
    .andWhere("p.situacao = 'pago'")
    .andWhere("p.numero_parcela > 0");
  if (id_empresa) pagPagosQb.andWhere("p.id_empresa = :id_empresa", { id_empresa });
  const qtdPagas = await pagPagosQb.getCount();

  if (qtdPagas > 0) {
    return res.status(409).json({
      error: "tem_parcelas_pagas",
      message: `Esta venda possui ${qtdPagas} parcela(s) já paga(s). Cancele os pagamentos antes de editar a venda.`,
    });
  }

  const { data_venda, valor_entrada, parcelas: novaQtdParcelas, valor_parcela } = parse.data;

  const despesaComissaoEdicao = await AppDataSource.getRepository(Despesa).findOne({ where: { id_venda_origem: venda.id_venda, id_empresa: id_empresa ?? 1 } });
  if (despesaComissaoEdicao && venda.comissao_percentual && (valor_entrada !== undefined || valor_parcela !== undefined || novaQtdParcelas !== undefined)) {
    const comissaoBaixada = await AppDataSource.getRepository(DespesaParcela).count({ where: { id_despesa: despesaComissaoEdicao.id_despesa, situacao: Not("aberto") } });
    if (comissaoBaixada > 0) return res.status(409).json({ error: "comissao_paga", message: "Estorne a comissão antes de alterar os valores da venda." });
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Data da venda
    if (data_venda) {
      const iso = normalizeIsoDate(data_venda);
      if (!iso) { await queryRunner.rollbackTransaction(); return res.status(400).json({ error: "Data inválida" }); }
      venda.data_venda = iso;
    }

    // 2. Valor da entrada — atualiza parcela 0 (entrada)
    if (valor_entrada !== undefined) {
      venda.valor_entrada = valor_entrada.toFixed(2);
      const entradaPag = await pagRepo.findOne({ where: { id_venda: Number(id), numero_parcela: 0 } });
      if (entradaPag) {
        entradaPag.valor = valor_entrada.toFixed(2);
        entradaPag.valor_pago = valor_entrada.toFixed(2);
        await queryRunner.manager.save(entradaPag);
      }
    }

    // 3. Valor da parcela — atualiza todas as parcelas abertas (numero_parcela > 0)
    const novoValorParcela = valor_parcela ?? Number(venda.valor_parcela);
    if (valor_parcela !== undefined) {
      venda.valor_parcela = valor_parcela.toFixed(2);
      await queryRunner.manager
        .createQueryBuilder()
        .update(Pagamento)
        .set({ valor: valor_parcela.toFixed(2) })
        .where("id_venda = :id_venda", { id_venda: Number(id) })
        .andWhere("situacao = 'aberto'")
        .andWhere("numero_parcela > 0")
        .execute();
    }

    // 4. Quantidade de parcelas
    if (novaQtdParcelas !== undefined && novaQtdParcelas !== venda.parcelas) {
      const oldQtd = venda.parcelas;
      if (novaQtdParcelas > oldQtd) {
        // Adiciona parcelas novas no final
        const dataBase = new Date((venda.data_venda ?? data_venda!) + "T12:00:00");
        const novasParcelas: Pagamento[] = [];
        for (let i = oldQtd + 1; i <= novaQtdParcelas; i++) {
          const vencDate = new Date(dataBase);
          vencDate.setMonth(vencDate.getMonth() + i);
          novasParcelas.push(queryRunner.manager.create(Pagamento, {
            id_venda: Number(id),
            numero_parcela: i,
            tipo: "boleto",
            situacao: "aberto",
            vencimento: vencDate.toISOString().slice(0, 10),
            valor: novoValorParcela.toFixed(2),
            multa: "0.00",
            juros: "0.00",
            id_empresa: id_empresa ?? 1,
          }));
        }
        await queryRunner.manager.save(novasParcelas);
      } else {
        // Remove parcelas abertas além do novo limite
        const parcelasExcedentes = await pagRepo
          .createQueryBuilder("p")
          .where("p.id_venda = :id_venda", { id_venda: Number(id) })
          .andWhere("p.numero_parcela > :limite", { limite: novaQtdParcelas })
          .andWhere("p.situacao = 'aberto'")
          .getMany();
        if (parcelasExcedentes.length > 0) {
          await queryRunner.manager.remove(parcelasExcedentes);
        }
      }
      venda.parcelas = novaQtdParcelas;
    }

    if (despesaComissaoEdicao && venda.comissao_percentual) {
      const novoTotalContrato = Number(venda.valor_entrada) + venda.parcelas * Number(venda.valor_parcela);
      const novaComissao = Math.round(novoTotalContrato * Number(venda.comissao_percentual) / 100 * 100) / 100;
      venda.comissao_valor = novaComissao.toFixed(2);
      despesaComissaoEdicao.valor_total = novaComissao.toFixed(2);
      await queryRunner.manager.save(despesaComissaoEdicao);
      await queryRunner.manager.createQueryBuilder().update(DespesaParcela).set({ valor: novaComissao.toFixed(2) }).where("id_despesa = :id", { id: despesaComissaoEdicao.id_despesa }).andWhere("situacao = 'aberto'").execute();
    }

    await queryRunner.manager.save(venda);
    await queryRunner.commitTransaction();

    await AuditoriaService.registrarVenda(req, "UPDATE", venda.id_venda, "Venda editada", parse.data);
    return res.json({ success: true });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("[PATCH /api/vendas/:id/editar]", error);
    return res.status(500).json({ error: "Erro ao editar venda" });
  } finally {
    await queryRunner.release();
  }
});

const renegociacaoSchema = z.object({
  motivo: z.string().trim().min(3).max(1000),
  parcelas: z.array(z.object({ vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), valor: z.number().positive() })).min(1).max(120),
});

vendasRouter.post("/:id/renegociar", requirePermission("vendas_alterar"), async (req: AuthRequest, res) => {
  const parse = renegociacaoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
  const idVenda = Number(req.params.id), idEmpresa = req.user!.id_empresa;
  const vendaRepo = AppDataSource.getRepository(Venda);
  const venda = await vendaRepo.findOne({ where: { id_venda: idVenda, id_empresa: idEmpresa } });
  if (!venda || venda.status !== "aberta") return res.status(409).json({ error: "Apenas vendas abertas podem ser renegociadas." });
  const pagamentos = await AppDataSource.getRepository(Pagamento).find({ where: { id_venda: idVenda, id_empresa: idEmpresa }, order: { numero_parcela: "ASC" } });
  const abertas = pagamentos.filter((p) => p.numero_parcela > 0 && p.situacao === "aberto");
  if (!abertas.length) return res.status(409).json({ error: "A venda não possui parcelas em aberto para renegociar." });
  const pagas = pagamentos.filter((p) => p.numero_parcela > 0 && p.situacao === "pago");
  const snapshotAntes = { parcelas_abertas: abertas.map((p) => ({ numero: p.numero_parcela, vencimento: p.vencimento, valor: p.valor })), total_aberto: abertas.reduce((s, p) => s + Number(p.valor), 0) };
  const inicio = Math.max(0, ...pagas.map((p) => p.numero_parcela)) + 1;
  const novas = parse.data.parcelas.map((p, indice) => ({ numero: inicio + indice, vencimento: p.vencimento, valor: p.valor.toFixed(2) }));
  await AppDataSource.transaction(async (manager) => {
    await manager.remove(abertas);
    await manager.save(novas.map((p) => manager.create(Pagamento, { id_empresa: idEmpresa, id_venda: idVenda, numero_parcela: p.numero, tipo: "boleto", situacao: "aberto", vencimento: p.vencimento, valor: p.valor, multa: "0.00", juros: "0.00" })));
    venda.parcelas = Math.max(0, ...pagas.map((p) => p.numero_parcela)) + novas.length;
    venda.valor_parcela = novas.every((p) => p.valor === novas[0].valor) ? novas[0].valor : null;
    await manager.save(venda);
    await manager.save(manager.create(VendaAcordo, { id_empresa: idEmpresa, id_venda: idVenda, tipo: "renegociacao", motivo: parse.data.motivo, snapshot_antes: snapshotAntes, snapshot_depois: { parcelas: novas, total: novas.reduce((s, p) => s + Number(p.valor), 0) }, id_usuario: req.user!.id_usuario }));
  });
  await AuditoriaService.registrarVenda(req, "UPDATE", idVenda, `Renegociação aplicada — ${abertas.length} parcela(s) substituída(s) por ${novas.length}`, { motivo: parse.data.motivo, antes: snapshotAntes, depois: novas });
  return res.json({ success: true, parcelas: novas.length });
});

const distratoSchema = z.object({ motivo: z.string().trim().min(3).max(1000) });
vendasRouter.post("/:id/distratar", requirePermission("vendas_alterar"), async (req: AuthRequest, res) => {
  const parse = distratoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Informe o motivo do distrato.", issues: parse.error.issues });
  const idVenda = Number(req.params.id), idEmpresa = req.user!.id_empresa;
  const venda = await AppDataSource.getRepository(Venda).findOne({ where: { id_venda: idVenda, id_empresa: idEmpresa } });
  if (!venda || venda.status !== "aberta") return res.status(409).json({ error: "Apenas vendas abertas podem ser distratadas." });
  const pagamentos = await AppDataSource.getRepository(Pagamento).find({ where: { id_venda: idVenda, id_empresa: idEmpresa } });
  const pagos = pagamentos.filter((p) => p.situacao === "pago");
  const abertos = pagamentos.filter((p) => p.situacao === "aberto");
  const totalPago = pagos.reduce((s, p) => s + Number(p.valor_pago ?? p.valor), 0);
  const despesaComissao = await AppDataSource.getRepository(Despesa).findOne({ where: { id_venda_origem: idVenda, id_empresa: idEmpresa } });
  let removerComissao = false;
  if (despesaComissao) {
    const parcelasComissao = await AppDataSource.getRepository(DespesaParcela).find({ where: { id_despesa: despesaComissao.id_despesa } });
    removerComissao = parcelasComissao.every((p) => p.situacao === "aberto");
  }
  await AppDataSource.transaction(async (manager) => {
    if (abertos.length) await manager.remove(abertos);
    if (despesaComissao && removerComissao) await manager.remove(despesaComissao);
    venda.status = "cancelada";
    await manager.save(venda);
    await manager.save(manager.create(VendaAcordo, { id_empresa: idEmpresa, id_venda: idVenda, tipo: "distrato", motivo: parse.data.motivo, snapshot_antes: { parcelas_pagas: pagos.length, parcelas_abertas: abertos.length, total_pago: totalPago }, snapshot_depois: { status: "cancelada", lote_liberado: true, devolucao_automatica: false, comissao_aberta_cancelada: removerComissao }, id_usuario: req.user!.id_usuario }));
  });
  await AuditoriaService.registrarVenda(req, "UPDATE", idVenda, `Distrato registrado — ${abertos.length} parcela(s) futura(s) cancelada(s), total histórico pago ${totalPago.toFixed(2)}`, { motivo: parse.data.motivo, total_pago: totalPago, devolucao_automatica: false });
  return res.json({ success: true, total_pago_preservado: totalPago });
});

vendasRouter.patch("/:id/cancelar", requireAuth, requirePermission("vendas_alterar"), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const vendaRepo = AppDataSource.getRepository(Venda);
  const pagamentoRepo = AppDataSource.getRepository(Pagamento);

  const whereVenda: Record<string, unknown> = { id_venda: Number(id) };
  if (req.user?.id_empresa) whereVenda.id_empresa = req.user.id_empresa;

  const venda = await vendaRepo.findOne({ where: whereVenda });

  if (!venda) {
    return res.status(404).json({ error: "Venda não encontrada" });
  }

  if (venda.status === "cancelada") {
    return res.status(400).json({ error: "Venda já está cancelada" });
  }

  // Check for paid parcelas
  const pagamentosPagos = await pagamentoRepo.count({
    where: {
      id_venda: Number(id),
      situacao: "pago",
      ...(req.user?.id_empresa ? { id_empresa: req.user.id_empresa } : {}),
    },
  });

  if (pagamentosPagos > 0) {
    return res.status(409).json({
      error: "tem_pagamentos",
      message: "Existem parcelas pagas nesta venda. Cancele os pagamentos antes de cancelar a venda.",
      id_cliente: venda.id_cliente,
    });
  }

  const despesaComissao = await AppDataSource.getRepository(Despesa).findOne({
    where: { id_venda_origem: Number(id), id_empresa: req.user?.id_empresa ?? 1 },
  });
  if (despesaComissao) {
    const baixasComissao = await AppDataSource.getRepository(DespesaParcela).count({
      where: { id_despesa: despesaComissao.id_despesa, situacao: Not("aberto") },
    });
    if (baixasComissao > 0) {
      return res.status(409).json({
        error: "comissao_paga",
        message: "A comissão desta venda possui baixa. Estorne o pagamento da comissão antes de cancelar a venda.",
      });
    }
  }

  // Exclui as parcelas geradas para esta venda (neste ponto todas estão em aberto,
  // pois parcelas pagas bloqueiam o cancelamento acima).
  const parcelasExcluidas = await pagamentoRepo.delete({
    id_venda: Number(id),
    ...(req.user?.id_empresa ? { id_empresa: req.user.id_empresa } : {}),
  });

  if (despesaComissao) await AppDataSource.getRepository(Despesa).remove(despesaComissao);

  venda.status = "cancelada";
  await vendaRepo.save(venda);

  // Registrar auditoria
  await AuditoriaService.registrarVenda(
    req,
    "UPDATE",
    venda.id_venda,
    `Venda cancelada — ${parcelasExcluidas.affected ?? 0} parcela(s) excluída(s)`
  );

  return res.json({ success: true });
});

vendasRouter.put("/:id", requireAuth, requirePermission("vendas_alterar"), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Venda);

  const where: Record<string, unknown> = { id_venda: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const venda = await repo.findOne({ where });

  if (!venda) {
    return res.status(404).json({ error: "Venda não encontrada" });
  }

  Object.assign(venda, req.body);

  const saved = await repo.save(venda);

  return res.json(saved);
});

vendasRouter.delete("/:id", requireAuth, requirePermission("vendas_excluir"), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Venda);

  const where: Record<string, unknown> = { id_venda: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const venda = await repo.findOne({ where });

  if (!venda) {
    return res.status(404).json({ error: "Venda não encontrada" });
  }

  await repo.remove(venda);

  return res.status(204).send();
});
