import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Loteamento } from "../../entities/Loteamento";
import { Lote } from "../../entities/Lote";
import { Venda } from "../../entities/Venda";
import { Cliente } from "../../entities/Cliente";
import { AuthRequest, requireAuth, requirePermission } from "../../middleware/auth";

export const loteamentosRouter = Router();

const loteamentoBodySchema = z.object({
  nome: z.string().min(1).max(200),
  endereco: z.string().max(300).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  tipo_pessoa: z.enum(["f", "j"]).optional(),
  prop_nome: z.string().max(200).optional(),
  cnpj: z.string().max(18).optional(),
  rg: z.string().max(20).optional(),
  estado_civil: z.string().max(50).optional(),
  conjuge: z.string().max(200).optional(),
  profissao: z.string().max(100).optional(),
  prop_endereco: z.string().max(300).optional(),
  prop_bairro: z.string().max(100).optional(),
  prop_cidade: z.string().max(100).optional(),
  prop_estado: z.string().max(2).optional(),
  prop_cep: z.string().max(9).optional(),
  prop_fone: z.string().max(20).optional(),
});

loteamentosRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const repo = AppDataSource.getRepository(Loteamento);

  const where: Record<string, unknown> = {};

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const loteamentos = await repo.find({
    where,
    order: { nome: "ASC" },
  });

  return res.json(loteamentos);
});

loteamentosRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const loteamentoRepo = AppDataSource.getRepository(Loteamento);
  const loteRepo = AppDataSource.getRepository(Lote);

  const whereLoteamento: Record<string, unknown> = { id_loteamento: Number(id) };

  if (req.user?.id_empresa) {
    whereLoteamento.id_empresa = req.user.id_empresa;
  }

  const loteamento = await loteamentoRepo.findOne({ where: whereLoteamento });

  if (!loteamento) {
    return res.status(404).json({ error: "Loteamento não encontrado" });
  }

  const whereLote: Record<string, unknown> = { id_loteamento: loteamento.id_loteamento };

  if (req.user?.id_empresa) {
    whereLote.id_empresa = req.user.id_empresa;
  }

  const totalLotes = await loteRepo.count({ where: whereLote });

  return res.json({
    ...loteamento,
    total_lotes: totalLotes,
  });
});

loteamentosRouter.get("/:id/lotes", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const idEmpresa = req.user?.id_empresa;

  const loteRepo = AppDataSource.getRepository(Lote);
  const vendaRepo = AppDataSource.getRepository(Venda);
  const clienteRepo = AppDataSource.getRepository(Cliente);

  const whereLote: Record<string, unknown> = { id_loteamento: Number(id) };
  if (idEmpresa) whereLote.id_empresa = idEmpresa;

  const lotes = await loteRepo.find({
    where: whereLote,
    order: { quadra: "ASC", lote: "ASC" },
  });

  // Busca vendas ativas dos lotes deste loteamento
  const idLotes = lotes.map((l) => l.id_lote);

  let vendasMap = new Map<number, { id_cliente: number; status: string }>();

  if (idLotes.length > 0) {
    const whereVenda: Record<string, unknown> = {};
    if (idEmpresa) whereVenda.id_empresa = idEmpresa;

    const vendas = await vendaRepo
      .createQueryBuilder("v")
      .where("v.id_lote IN (:...ids)", { ids: idLotes })
      .andWhere(idEmpresa ? "v.id_empresa = :emp" : "1=1", { emp: idEmpresa })
      .andWhere("v.status != :cancelada", { cancelada: "cancelada" })
      .getMany();

    for (const v of vendas) {
      vendasMap.set(v.id_lote, { id_cliente: v.id_cliente, status: v.status });
    }
  }

  // Busca clientes referenciados
  const idClientes = [...new Set([...vendasMap.values()].map((v) => v.id_cliente))];
  let clientesMap = new Map<number, string>();

  if (idClientes.length > 0) {
    const clientes = await clienteRepo
      .createQueryBuilder("c")
      .where("c.id_cliente IN (:...ids)", { ids: idClientes })
      .getMany();

    for (const c of clientes) {
      clientesMap.set(c.id_cliente, c.nome);
    }
  }

  const result = lotes.map((lote) => {
    const venda = vendasMap.get(lote.id_lote);
    return {
      id_lote: lote.id_lote,
      lote: lote.lote,
      quadra: lote.quadra,
      area: lote.area ?? null,
      frente: lote.frente ?? null,
      fundo: lote.fundo ?? null,
      status: venda ? "vendido" : "disponivel",
      cliente: venda ? (clientesMap.get(venda.id_cliente) ?? null) : null,
      status_venda: venda?.status ?? null,
    };
  });

  return res.json(result);
});

loteamentosRouter.post("/", requireAuth, requirePermission("loteamentos_cadastrar"), async (req: AuthRequest, res) => {
  const parseResult = loteamentoBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Loteamento);
  const loteamento = repo.create({
    ...parseResult.data,
    id_empresa: req.user?.id_empresa ?? 1,
  });
  const saved = await repo.save(loteamento);

  return res.status(201).json(saved);
});

loteamentosRouter.put("/:id", requireAuth, requirePermission("loteamentos_alterar"), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const parseResult = loteamentoBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Loteamento);

  const where: Record<string, unknown> = { id_loteamento: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const loteamento = await repo.findOne({ where });

  if (!loteamento) {
    return res.status(404).json({ error: "Loteamento não encontrado" });
  }

  Object.assign(loteamento, parseResult.data);

  const saved = await repo.save(loteamento);

  return res.json(saved);
});

loteamentosRouter.delete("/:id", requireAuth, requirePermission("loteamentos_excluir"), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Loteamento);

  const where: Record<string, unknown> = { id_loteamento: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const loteamento = await repo.findOne({ where });

  if (!loteamento) {
    return res.status(404).json({ error: "Loteamento não encontrado" });
  }

  await repo.remove(loteamento);

  return res.status(204).send();
});
