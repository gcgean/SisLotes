import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Venda } from "../../entities/Venda";
import { Cliente } from "../../entities/Cliente";
import { Lote } from "../../entities/Lote";
import { Pagamento } from "../../entities/Pagamento";
import { Log } from "../../entities/Log";
import { AuthRequest, requireAuth, requirePermission } from "../../middleware/auth";

export const vendasRouter = Router();

const createVendaSchema = z.object({
  id_cliente: z.number().int().positive(),
  id_lote: z.number().int().positive(),
  data_venda: z.string(),
  valor_entrada: z.number().nonnegative(),
  parcelas: z.number().int().positive(),
  porcentagem: z.number().nonnegative(),
  valor_lote: z.number().positive(),
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

  const { id_cliente, id_lote, data_venda, valor_entrada, parcelas, porcentagem, valor_lote } = parseResult.data;

  const user = req.user;

  const clienteRepo = AppDataSource.getRepository(Cliente);
  const loteRepo = AppDataSource.getRepository(Lote);
  const vendaRepo = AppDataSource.getRepository(Venda);
  const pagamentoRepo = AppDataSource.getRepository(Pagamento);
  const logRepo = AppDataSource.getRepository(Log);

  const cliente = await clienteRepo.findOne({ where: { id_cliente } });
  if (!cliente) {
    return res.status(400).json({ error: "Cliente inválido" });
  }

  const lote = await loteRepo.findOne({ where: { id_lote } });
  if (!lote) {
    return res.status(400).json({ error: "Lote inválido" });
  }

  const existingVenda = await vendaRepo.findOne({ where: { id_lote } });
  if (existingVenda) {
    return res.status(400).json({ error: "Lote já está vinculado a outra venda" });
  }

  const saldo = valor_lote - valor_entrada;
  const valorParcelaBase = saldo / parcelas;

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const venda = queryRunner.manager.create(Venda, {
      id_cliente,
      id_lote,
      data_venda,
      valor_entrada: valor_entrada.toFixed(2),
      parcelas,
      porcentagem: porcentagem.toFixed(2),
      status: "aberta",
      id_empresa: user?.id_empresa ?? 1,
    });

    const savedVenda = await queryRunner.manager.save(venda);

    const pagamentos: Pagamento[] = [];
    let acumulado = 0;

    for (let i = 1; i <= parcelas; i++) {
      let valorParcela = Number(valorParcelaBase.toFixed(2));

      if (i === parcelas) {
        valorParcela = Number((saldo - acumulado).toFixed(2));
      }

      acumulado += valorParcela;

      const baseDate = new Date(data_venda);
      const vencimentoDate = new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000);
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
      log: `Venda ${savedVenda.id_venda} criada com ${parcelas} parcelas`,
      query: JSON.stringify(parseResult.data),
    });

    await queryRunner.manager.save(log);

    await queryRunner.commitTransaction();

    const vendaComPagamentos = await vendaRepo.findOne({
      where: { id_venda: savedVenda.id_venda },
      relations: ["pagamentos"],
    });

    return res.status(201).json(vendaComPagamentos);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    return res.status(500).json({ error: "Erro ao criar venda" });
  } finally {
    await queryRunner.release();
  }
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
