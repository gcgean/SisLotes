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

vendasRouter.get("/", requireAuth, async (_req, res) => {
  const repo = AppDataSource.getRepository(Venda);

  const vendas = await repo.find({
    order: { data_venda: "DESC" },
  });

  return res.json(vendas);
});

vendasRouter.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Venda);
  const venda = await repo.findOne({
    where: { id_venda: Number(id) },
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

vendasRouter.put("/:id", requireAuth, requirePermission("vendas_alterar"), async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Venda);

  const venda = await repo.findOne({ where: { id_venda: Number(id) } });

  if (!venda) {
    return res.status(404).json({ error: "Venda não encontrada" });
  }

  Object.assign(venda, req.body);

  const saved = await repo.save(venda);

  return res.json(saved);
});

vendasRouter.delete("/:id", requireAuth, requirePermission("vendas_excluir"), async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Venda);

  const venda = await repo.findOne({ where: { id_venda: Number(id) } });

  if (!venda) {
    return res.status(404).json({ error: "Venda não encontrada" });
  }

  await repo.remove(venda);

  return res.status(204).send();
});
