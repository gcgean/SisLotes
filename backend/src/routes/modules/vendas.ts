import { Router } from "express";
import { z } from "zod";
import { Not } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { Venda } from "../../entities/Venda";
import { Cliente } from "../../entities/Cliente";
import { Lote } from "../../entities/Lote";
import { Pagamento } from "../../entities/Pagamento";
import { Log } from "../../entities/Log";
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

const createVendaSchema = z.object({
  id_cliente: z.number().int().positive(),
  id_lote: z.number().int().positive(),
  data_venda: z.string(),
  valor_entrada: z.number().nonnegative(),
  parcelas: z.number().int().positive(),
  valor_parcela: z.number().nonnegative(),
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
    relations: ["pagamentos"],
  });

  if (!venda) {
    return res.status(404).json({ error: "Venda não encontrada" });
  }

  return res.json(venda);
});

vendasRouter.post("/", requireAuth, requirePermission("vendas_cadastrar"), async (req: AuthRequest, res) => {
  const parseResult = createVendaSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const { id_cliente, id_lote, data_venda, valor_entrada, parcelas, valor_parcela } = parseResult.data;
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
      ...(process.env.NODE_ENV !== "production" ? { detail } : {}),
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

  venda.status = "cancelada";
  await vendaRepo.save(venda);

  // Registrar auditoria
  await AuditoriaService.registrarVenda(
    req,
    "UPDATE",
    venda.id_venda,
    "Venda cancelada"
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
