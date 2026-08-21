"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loteamentosRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const Loteamento_1 = require("../../entities/Loteamento");
const Lote_1 = require("../../entities/Lote");
const Venda_1 = require("../../entities/Venda");
const Cliente_1 = require("../../entities/Cliente");
const auth_1 = require("../../middleware/auth");
exports.loteamentosRouter = (0, express_1.Router)();
const loteamentoBodySchema = zod_1.z.object({
    nome: zod_1.z.string().min(1).max(200),
    endereco: zod_1.z.string().max(300).optional(),
    cidade: zod_1.z.string().max(100).optional(),
    estado: zod_1.z.string().max(2).optional(),
    tipo_pessoa: zod_1.z.enum(["f", "j"]).optional(),
    prop_nome: zod_1.z.string().max(200).optional(),
    cnpj: zod_1.z.string().max(18).optional(),
    rg: zod_1.z.string().max(20).optional(),
    estado_civil: zod_1.z.string().max(50).optional(),
    conjuge: zod_1.z.string().max(200).optional(),
    profissao: zod_1.z.string().max(100).optional(),
    prop_endereco: zod_1.z.string().max(300).optional(),
    prop_bairro: zod_1.z.string().max(100).optional(),
    prop_cidade: zod_1.z.string().max(100).optional(),
    prop_estado: zod_1.z.string().max(2).optional(),
    prop_cep: zod_1.z.string().max(9).optional(),
    prop_fone: zod_1.z.string().max(20).optional(),
});
exports.loteamentosRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const repo = data_source_1.AppDataSource.getRepository(Loteamento_1.Loteamento);
    const where = {};
    if (req.user?.id_empresa) {
        where.id_empresa = req.user.id_empresa;
    }
    const loteamentos = await repo.find({
        where,
        order: { nome: "ASC" },
    });
    return res.json(loteamentos);
});
exports.loteamentosRouter.get("/:id", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const loteamentoRepo = data_source_1.AppDataSource.getRepository(Loteamento_1.Loteamento);
    const loteRepo = data_source_1.AppDataSource.getRepository(Lote_1.Lote);
    const whereLoteamento = { id_loteamento: Number(id) };
    if (req.user?.id_empresa) {
        whereLoteamento.id_empresa = req.user.id_empresa;
    }
    const loteamento = await loteamentoRepo.findOne({ where: whereLoteamento });
    if (!loteamento) {
        return res.status(404).json({ error: "Loteamento não encontrado" });
    }
    const whereLote = { id_loteamento: loteamento.id_loteamento };
    if (req.user?.id_empresa) {
        whereLote.id_empresa = req.user.id_empresa;
    }
    const totalLotes = await loteRepo.count({ where: whereLote });
    return res.json({
        ...loteamento,
        total_lotes: totalLotes,
    });
});
exports.loteamentosRouter.get("/:id/lotes", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const idEmpresa = req.user?.id_empresa;
    const loteRepo = data_source_1.AppDataSource.getRepository(Lote_1.Lote);
    const vendaRepo = data_source_1.AppDataSource.getRepository(Venda_1.Venda);
    const clienteRepo = data_source_1.AppDataSource.getRepository(Cliente_1.Cliente);
    const whereLote = { id_loteamento: Number(id) };
    if (idEmpresa)
        whereLote.id_empresa = idEmpresa;
    const lotes = await loteRepo.find({
        where: whereLote,
        order: { quadra: "ASC", lote: "ASC" },
    });
    // Busca vendas ativas dos lotes deste loteamento
    const idLotes = lotes.map((l) => l.id_lote);
    const vendasMap = new Map();
    if (idLotes.length > 0) {
        const whereVenda = {};
        if (idEmpresa)
            whereVenda.id_empresa = idEmpresa;
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
    const clientesMap = new Map();
    if (idClientes.length > 0) {
        const qbClientes = clienteRepo
            .createQueryBuilder("c")
            .where("c.id_cliente IN (:...ids)", { ids: idClientes });
        if (idEmpresa) {
            qbClientes.andWhere("c.id_empresa = :id_empresa", { id_empresa: idEmpresa });
        }
        const clientes = await qbClientes.getMany();
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
exports.loteamentosRouter.post("/", auth_1.requireAuth, (0, auth_1.requirePermission)("loteamentos_cadastrar"), async (req, res) => {
    const parseResult = loteamentoBodySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Loteamento_1.Loteamento);
    const loteamento = repo.create({
        ...parseResult.data,
        id_empresa: req.user?.id_empresa ?? 1,
    });
    const saved = await repo.save(loteamento);
    return res.status(201).json(saved);
});
exports.loteamentosRouter.put("/:id", auth_1.requireAuth, (0, auth_1.requirePermission)("loteamentos_alterar"), async (req, res) => {
    const { id } = req.params;
    const parseResult = loteamentoBodySchema.partial().safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Loteamento_1.Loteamento);
    const where = { id_loteamento: Number(id) };
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
exports.loteamentosRouter.delete("/:id", auth_1.requireAuth, (0, auth_1.requirePermission)("loteamentos_excluir"), async (req, res) => {
    const { id } = req.params;
    const repo = data_source_1.AppDataSource.getRepository(Loteamento_1.Loteamento);
    const loteRepo = data_source_1.AppDataSource.getRepository(Lote_1.Lote);
    const vendaRepo = data_source_1.AppDataSource.getRepository(Venda_1.Venda);
    const where = { id_loteamento: Number(id) };
    if (req.user?.id_empresa) {
        where.id_empresa = req.user.id_empresa;
    }
    const loteamento = await repo.findOne({ where });
    if (!loteamento) {
        return res.status(404).json({ error: "Loteamento não encontrado" });
    }
    // Verifica se há lotes cadastrados
    const hasLotes = await loteRepo.count({ where: { id_loteamento: loteamento.id_loteamento } });
    if (hasLotes > 0) {
        // Verifica se algum desses lotes tem venda
        const lotesDoLoteamento = await loteRepo.find({ select: ["id_lote"], where: { id_loteamento: loteamento.id_loteamento } });
        const idsLotes = lotesDoLoteamento.map(l => l.id_lote);
        if (idsLotes.length > 0) {
            const hasVendas = await vendaRepo.createQueryBuilder("v")
                .where("v.id_lote IN (:...ids)", { ids: idsLotes })
                .andWhere("v.status != :cancelada", { cancelada: "cancelada" })
                .getCount();
            if (hasVendas > 0) {
                return res.status(400).json({ error: "Não é possível excluir loteamento com lotes vendidos ou com movimentação." });
            }
        }
        // Se tem lotes, mas nenhuma venda ativa, apaga os lotes primeiro
        await loteRepo.delete({ id_loteamento: loteamento.id_loteamento });
    }
    await repo.remove(loteamento);
    return res.status(204).send();
});
