"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.empresasRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const Empresa_1 = require("../../entities/Empresa");
const auth_1 = require("../../middleware/auth");
const AuditoriaService_1 = require("../../services/AuditoriaService");
exports.empresasRouter = (0, express_1.Router)();
function isPlatformAdmin(user) {
    return user?.login?.toLowerCase() === "gcgean";
}
const empresaBodySchema = zod_1.z.object({
    nome_fantasia: zod_1.z.string().min(1).max(200),
    razao_social: zod_1.z.string().max(200).optional(),
    cnpj: zod_1.z.string().max(18).optional(),
    ie: zod_1.z.string().max(20).optional(),
    endereco: zod_1.z.string().max(300).optional(),
    bairro: zod_1.z.string().max(100).optional(),
    cidade: zod_1.z.string().max(100).optional(),
    estado: zod_1.z.string().max(2).optional(),
    cep: zod_1.z.string().max(9).optional(),
    telefone: zod_1.z.string().max(20).optional(),
    email: zod_1.z.string().max(200).optional(),
    site: zod_1.z.string().max(200).optional(),
    salario_minimo: zod_1.z.number().nonnegative().optional().nullable(),
    multa_percentual: zod_1.z.number().min(0).max(100).optional(),
    juros_percentual_dia: zod_1.z.number().min(0).max(100).optional(),
    carencia_dias: zod_1.z.number().int().min(0).optional(),
    logo: zod_1.z.string().optional().nullable(),
    modelo_contrato: zod_1.z.string().optional().nullable(),
    ativo: zod_1.z.boolean().optional(),
    hub_customer_id: zod_1.z.string().max(80).optional().nullable(),
    hub_product_code: zod_1.z.string().max(80).optional().nullable(),
    hub_license_status: zod_1.z.string().max(40).optional().nullable(),
    hub_license_reason: zod_1.z.string().max(80).optional().nullable(),
    hub_expires_at: zod_1.z.string().optional().nullable(),
    hub_features: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
    ignorar_controle_planos: zod_1.z.boolean().optional(),
});
// ─── Listar todas (master only) ───────────────────────────────────────────────
exports.empresasRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const currentUser = req.user;
    if (!isPlatformAdmin(currentUser)) {
        return res.status(403).json({ error: "Apenas usuário master pode listar empresas" });
    }
    const repo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
    const empresas = await repo.find({ order: { nome_fantasia: "ASC" } });
    return res.json(empresas);
});
// ─── Obter minha empresa (qualquer usuário autenticado) ───────────────────────
exports.empresasRouter.get("/minha", auth_1.requireAuth, async (req, res) => {
    const currentUser = req.user;
    if (!currentUser?.id_empresa) {
        return res.status(404).json({ error: "Empresa não associada ao usuário" });
    }
    const repo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
    const empresa = await repo.findOne({ where: { id_empresa: currentUser.id_empresa } });
    if (!empresa) {
        return res.status(404).json({ error: "Empresa não encontrada" });
    }
    return res.json(empresa);
});
// ─── Atualizar minha empresa ───────────────────────────────────────────────────
exports.empresasRouter.put("/minha", auth_1.requireAuth, async (req, res) => {
    const currentUser = req.user;
    if (!currentUser?.id_empresa) {
        return res.status(404).json({ error: "Empresa não associada ao usuário" });
    }
    const parseResult = empresaBodySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
    const empresa = await repo.findOne({ where: { id_empresa: currentUser.id_empresa } });
    if (!empresa) {
        return res.status(404).json({ error: "Empresa não encontrada" });
    }
    const encargosAntigos = {
        multa_percentual: empresa.multa_percentual,
        juros_percentual_dia: empresa.juros_percentual_dia,
        carencia_dias: empresa.carencia_dias,
    };
    const { logo, modelo_contrato, salario_minimo, multa_percentual, juros_percentual_dia, carencia_dias, hub_customer_id: _hub_customer_id, hub_product_code: _hub_product_code, hub_license_status: _hub_license_status, hub_license_reason: _hub_license_reason, hub_expires_at: _hub_expires_at, hub_features: _hub_features, ...rest } = parseResult.data;
    Object.assign(empresa, rest);
    // Logo: aceita null para remover, undefined para não alterar
    if (logo !== undefined) {
        empresa.logo = logo ?? null;
    }
    // modelo_contrato: aceita null para limpar, undefined para não alterar
    if (modelo_contrato !== undefined) {
        empresa.modelo_contrato = modelo_contrato ?? null;
    }
    // salario_minimo: converte number para string (decimal no banco)
    if (salario_minimo !== undefined) {
        empresa.salario_minimo = salario_minimo != null ? String(salario_minimo) : null;
    }
    // Encargos
    if (multa_percentual !== undefined)
        empresa.multa_percentual = String(multa_percentual);
    if (juros_percentual_dia !== undefined)
        empresa.juros_percentual_dia = String(juros_percentual_dia);
    if (carencia_dias !== undefined)
        empresa.carencia_dias = carencia_dias;
    const saved = await repo.save(empresa);
    if (multa_percentual !== undefined || juros_percentual_dia !== undefined || carencia_dias !== undefined) {
        await AuditoriaService_1.AuditoriaService.registrar(req, "configuracoes_financeiras", "UPDATE", saved.id_empresa, encargosAntigos, {
            multa_percentual: saved.multa_percentual,
            juros_percentual_dia: saved.juros_percentual_dia,
            carencia_dias: saved.carencia_dias,
        }, "Configuração de multa, juros e carência alterada");
    }
    return res.json(saved);
});
// ─── Criar empresa (master only) ─────────────────────────────────────────────
exports.empresasRouter.post("/", auth_1.requireAuth, async (req, res) => {
    const currentUser = req.user;
    if (!isPlatformAdmin(currentUser)) {
        return res.status(403).json({ error: "Apenas usuário master pode criar empresas" });
    }
    const parseResult = empresaBodySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
    const { salario_minimo: smNum, multa_percentual: multaNum, juros_percentual_dia: jurosNum, carencia_dias: carenciaNum, hub_expires_at, ...restData } = parseResult.data;
    const empresa = repo.create({
        ...restData,
        hub_expires_at: hub_expires_at ? new Date(hub_expires_at) : null,
        salario_minimo: smNum != null ? String(smNum) : null,
        multa_percentual: multaNum != null ? String(multaNum) : "2.00",
        juros_percentual_dia: jurosNum != null ? String(jurosNum) : "0.2000",
        carencia_dias: carenciaNum ?? 0,
        ativo: true,
    });
    const saved = await repo.save(empresa);
    return res.status(201).json(saved);
});
// ─── Ativar/desativar empresa (master only) ───────────────────────────────────
exports.empresasRouter.put("/:id/ativo", auth_1.requireAuth, async (req, res) => {
    const currentUser = req.user;
    if (!isPlatformAdmin(currentUser)) {
        return res.status(403).json({ error: "Apenas usuário master pode alterar empresas" });
    }
    const { id } = req.params;
    const parseResult = zod_1.z
        .object({ ativo: zod_1.z.boolean() })
        .safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
    const empresa = await repo.findOne({ where: { id_empresa: Number(id) } });
    if (!empresa) {
        return res.status(404).json({ error: "Empresa não encontrada" });
    }
    empresa.ativo = parseResult.data.ativo;
    const saved = await repo.save(empresa);
    return res.json(saved);
});
