"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usuariosRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const Usuario_1 = require("../../entities/Usuario");
const Empresa_1 = require("../../entities/Empresa");
const auth_1 = require("../../middleware/auth");
const HubBillingService_1 = require("../../services/HubBillingService");
exports.usuariosRouter = (0, express_1.Router)();
const usuarioBodySchema = zod_1.z.object({
    login: zod_1.z.string().min(1).max(50),
    senha: zod_1.z.string().min(4).max(100),
    user_master: zod_1.z.boolean().optional().default(false),
    clientes_cadastrar: zod_1.z.boolean().optional().default(false),
    clientes_alterar: zod_1.z.boolean().optional().default(false),
    clientes_excluir: zod_1.z.boolean().optional().default(false),
    loteamentos_cadastrar: zod_1.z.boolean().optional().default(false),
    loteamentos_alterar: zod_1.z.boolean().optional().default(false),
    loteamentos_excluir: zod_1.z.boolean().optional().default(false),
    vendas_cadastrar: zod_1.z.boolean().optional().default(false),
    vendas_alterar: zod_1.z.boolean().optional().default(false),
    vendas_excluir: zod_1.z.boolean().optional().default(false),
    financeiro_estornar: zod_1.z.boolean().optional().default(false),
    financeiro_excluir: zod_1.z.boolean().optional().default(false),
    financeiro_lancar_retroativo: zod_1.z.boolean().optional().default(false),
    id_empresa: zod_1.z.number().int().positive().optional(),
});
exports.usuariosRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const currentUser = req.user;
    if (!currentUser || !currentUser.user_master) {
        return res.status(403).json({ error: "Apenas usuário master pode listar usuários" });
    }
    const repo = data_source_1.AppDataSource.getRepository(Usuario_1.Usuario);
    const where = {};
    if (currentUser.id_empresa) {
        where.id_empresa = currentUser.id_empresa;
    }
    const usuarios = await repo.find({ where, order: { login: "ASC" } });
    return res.json(usuarios);
});
exports.usuariosRouter.post("/", auth_1.requireAuth, async (req, res) => {
    const currentUser = req.user;
    if (!currentUser || !currentUser.user_master) {
        return res.status(403).json({ error: "Apenas usuário master pode criar usuários" });
    }
    const parseResult = usuarioBodySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Usuario_1.Usuario);
    const existing = await repo.findOne({ where: { login: parseResult.data.login } });
    if (existing) {
        return res.status(400).json({ error: "Login já em uso" });
    }
    const data = parseResult.data;
    const targetEmpresaId = data.id_empresa ?? currentUser.id_empresa;
    const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
    const empresa = await empresaRepo.findOne({ where: { id_empresa: targetEmpresaId } });
    if (!empresa) {
        return res.status(400).json({ error: "Empresa inválida" });
    }
    try {
        await HubBillingService_1.HubBillingService.syncEmpresaLicense(empresa);
    }
    catch (error) {
        console.error("Falha ao sincronizar licença da empresa para validação de max_users:", error);
    }
    const maxUsersFeature = empresa.hub_features?.max_users;
    const maxUsers = typeof maxUsersFeature === "number"
        ? maxUsersFeature
        : typeof maxUsersFeature === "string" && !Number.isNaN(Number(maxUsersFeature))
            ? Number(maxUsersFeature)
            : null;
    if (maxUsers != null && maxUsers > 0) {
        const currentUsersCount = await repo.count({ where: { id_empresa: targetEmpresaId } });
        if (currentUsersCount >= maxUsers) {
            return res.status(403).json({
                error: "Limite de usuários do plano atingido",
                feature: "max_users",
                max_users: maxUsers,
            });
        }
    }
    const usuario = repo.create({
        ...data,
        id_empresa: targetEmpresaId,
    });
    const saved = await repo.save(usuario);
    return res.status(201).json(saved);
});
exports.usuariosRouter.put("/:id", auth_1.requireAuth, async (req, res) => {
    const currentUser = req.user;
    if (!currentUser || !currentUser.user_master) {
        return res.status(403).json({ error: "Apenas usuário master pode alterar usuários" });
    }
    const { id } = req.params;
    const parseResult = usuarioBodySchema.partial().safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Usuario_1.Usuario);
    const where = { id_usuario: Number(id) };
    if (currentUser.id_empresa) {
        where.id_empresa = currentUser.id_empresa;
    }
    const usuario = await repo.findOne({ where });
    if (!usuario) {
        return res.status(404).json({ error: "Usuário não encontrado" });
    }
    if (usuario.id_usuario === currentUser.id_usuario && parseResult.data.user_master === false) {
        return res.status(400).json({ error: "Não é possível remover seu próprio acesso master" });
    }
    Object.assign(usuario, parseResult.data);
    const saved = await repo.save(usuario);
    return res.json(saved);
});
exports.usuariosRouter.delete("/:id", auth_1.requireAuth, async (req, res) => {
    const currentUser = req.user;
    if (!currentUser || !currentUser.user_master) {
        return res.status(403).json({ error: "Apenas usuário master pode excluir usuários" });
    }
    const { id } = req.params;
    const repo = data_source_1.AppDataSource.getRepository(Usuario_1.Usuario);
    const where = { id_usuario: Number(id) };
    if (currentUser.id_empresa) {
        where.id_empresa = currentUser.id_empresa;
    }
    const usuario = await repo.findOne({ where });
    if (!usuario) {
        return res.status(404).json({ error: "Usuário não encontrado" });
    }
    if (usuario.id_usuario === currentUser.id_usuario) {
        return res.status(400).json({ error: "Não é possível excluir o próprio usuário" });
    }
    await repo.remove(usuario);
    return res.status(204).send();
});
