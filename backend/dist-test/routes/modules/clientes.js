"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../db/data-source");
const Cliente_1 = require("../../entities/Cliente");
const auth_1 = require("../../middleware/auth");
exports.clientesRouter = (0, express_1.Router)();
// ─── CPF/CNPJ validation helpers ─────────────────────────────────────────────
function allDigitsEqual(d) { return /^(\d)\1+$/.test(d); }
function isValidCpf(raw) {
    const d = raw.replace(/\D/g, "");
    if (d.length !== 11 || allDigitsEqual(d))
        return false;
    const n = d.split("").map(Number);
    let s = 0;
    for (let i = 0; i < 9; i++)
        s += n[i] * (10 - i);
    let mod = s % 11;
    const d1 = mod < 2 ? 0 : 11 - mod;
    if (n[9] !== d1)
        return false;
    s = 0;
    for (let i = 0; i < 10; i++)
        s += n[i] * (11 - i);
    mod = s % 11;
    const d2 = mod < 2 ? 0 : 11 - mod;
    return n[10] === d2;
}
function isValidCnpj(raw) {
    const d = raw.replace(/\D/g, "");
    if (d.length !== 14 || allDigitsEqual(d))
        return false;
    const n = d.split("").map(Number);
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < 12; i++)
        s += n[i] * w1[i];
    let mod = s % 11;
    const d1 = mod < 2 ? 0 : 11 - mod;
    if (n[12] !== d1)
        return false;
    s = 0;
    for (let i = 0; i < 13; i++)
        s += n[i] * w2[i];
    mod = s % 11;
    const d2 = mod < 2 ? 0 : 11 - mod;
    return n[13] === d2;
}
// ─────────────────────────────────────────────────────────────────────────────
const listQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(5000).default(20),
    search: zod_1.z.string().optional(),
    tipo: zod_1.z.enum(["f", "j"]).optional(),
});
// Base object schema — can call .partial() on it
const clienteBaseSchema = zod_1.z.object({
    tipo: zod_1.z.enum(["f", "j"]),
    nome: zod_1.z.string().min(1, "Nome é obrigatório").max(200),
    razao_social: zod_1.z.string().max(200).optional(),
    cpf: zod_1.z.string().max(14).optional().refine((v) => !v || v.trim() === "" || isValidCpf(v), { message: "CPF inválido" }),
    cnpj: zod_1.z.string().max(18).optional().refine((v) => !v || v.trim() === "" || isValidCnpj(v), { message: "CNPJ inválido" }),
    rg: zod_1.z.string().max(20).optional(),
    estado_civil: zod_1.z.string().max(30).optional(),
    conjuge: zod_1.z.string().max(200).optional(),
    profissao: zod_1.z.string().max(100).optional(),
    endereco: zod_1.z.string().max(300).optional(),
    bairro: zod_1.z.string().max(100).optional(),
    cidade: zod_1.z.string().max(100).optional(),
    estado: zod_1.z.string().max(2).optional(),
    cep: zod_1.z.string().max(9).optional(),
    complemento: zod_1.z.string().max(200).optional(),
    fone_res: zod_1.z.string().max(20).optional(),
    fone_com: zod_1.z.string().max(20).optional(),
    email: zod_1.z.string().email("E-mail inválido").max(200).optional().or(zod_1.z.literal("")),
});
// For CREATE: add cross-field validation (CPF required for PF, CNPJ for PJ)
const clienteBodySchema = clienteBaseSchema.superRefine((data, ctx) => {
    if (data.tipo === "f" && !data.cpf?.trim()) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "CPF é obrigatório para pessoa física", path: ["cpf"] });
    }
    if (data.tipo === "j" && !data.cnpj?.trim()) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "CNPJ é obrigatório para pessoa jurídica", path: ["cnpj"] });
    }
});
// For UPDATE: partial — tipo/nome/cpf/cnpj all optional
const clienteUpdateSchema = clienteBaseSchema.partial();
exports.clientesRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const parseResult = listQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { page, limit, search, tipo } = parseResult.data;
    const repo = data_source_1.AppDataSource.getRepository(Cliente_1.Cliente);
    const where = {};
    if (req.user?.id_empresa) {
        where.id_empresa = req.user.id_empresa;
    }
    if (tipo) {
        where.tipo = tipo;
    }
    if (search) {
        where.nome = (0, typeorm_1.ILike)(`%${search}%`);
    }
    const [data, total] = await repo.findAndCount({
        where,
        skip: (page - 1) * limit,
        take: limit,
        order: { nome: "ASC" },
    });
    return res.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    });
});
exports.clientesRouter.get("/:id", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const repo = data_source_1.AppDataSource.getRepository(Cliente_1.Cliente);
    const where = { id_cliente: Number(id) };
    if (req.user?.id_empresa) {
        where.id_empresa = req.user.id_empresa;
    }
    const cliente = await repo.findOne({ where });
    if (!cliente) {
        return res.status(404).json({ error: "Cliente não encontrado" });
    }
    return res.json(cliente);
});
exports.clientesRouter.post("/", auth_1.requireAuth, (0, auth_1.requirePermission)("clientes_cadastrar"), async (req, res) => {
    const parseResult = clienteBodySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Cliente_1.Cliente);
    const data = parseResult.data;
    const cliente = repo.create({
        ...data,
        cpf: data.cpf && data.cpf.trim() !== "" ? data.cpf : null,
        cnpj: data.cnpj && data.cnpj.trim() !== "" ? data.cnpj : null,
        id_empresa: req.user?.id_empresa ?? 1,
    });
    try {
        const saved = await repo.save(cliente);
        return res.status(201).json(saved);
    }
    catch (error) {
        if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
            const message = error.message;
            if (message.includes("idx_clientes_cpf") || message.includes("clientes_cpf")) {
                return res.status(400).json({ error: "CPF já cadastrado" });
            }
            if (message.includes("idx_clientes_cnpj") || message.includes("clientes_cnpj")) {
                return res.status(400).json({ error: "CNPJ já cadastrado" });
            }
        }
        console.error("Erro ao salvar cliente (POST):", error);
        return res.status(500).json({ error: "Erro ao salvar cliente" });
    }
});
exports.clientesRouter.put("/:id", auth_1.requireAuth, (0, auth_1.requirePermission)("clientes_alterar"), async (req, res) => {
    const { id } = req.params;
    const parseResult = clienteUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
    }
    const repo = data_source_1.AppDataSource.getRepository(Cliente_1.Cliente);
    const where = { id_cliente: Number(id) };
    if (req.user?.id_empresa) {
        where.id_empresa = req.user.id_empresa;
    }
    const cliente = await repo.findOne({ where });
    if (!cliente) {
        return res.status(404).json({ error: "Cliente não encontrado" });
    }
    const data = parseResult.data;
    Object.assign(cliente, data);
    if ("cpf" in data) {
        cliente.cpf = data.cpf && data.cpf.trim() !== "" ? data.cpf : null;
    }
    if ("cnpj" in data) {
        cliente.cnpj = data.cnpj && data.cnpj.trim() !== "" ? data.cnpj : null;
    }
    try {
        const saved = await repo.save(cliente);
        return res.json(saved);
    }
    catch (error) {
        if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
            const message = error.message;
            if (message.includes("idx_clientes_cpf") || message.includes("clientes_cpf")) {
                return res.status(400).json({ error: "CPF já cadastrado" });
            }
            if (message.includes("idx_clientes_cnpj") || message.includes("clientes_cnpj")) {
                return res.status(400).json({ error: "CNPJ já cadastrado" });
            }
        }
        console.error("Erro ao salvar cliente (PUT):", error);
        return res.status(500).json({ error: "Erro ao salvar cliente" });
    }
});
exports.clientesRouter.delete("/:id", auth_1.requireAuth, (0, auth_1.requirePermission)("clientes_excluir"), async (req, res) => {
    const { id } = req.params;
    const repo = data_source_1.AppDataSource.getRepository(Cliente_1.Cliente);
    const where = { id_cliente: Number(id) };
    if (req.user?.id_empresa) {
        where.id_empresa = req.user.id_empresa;
    }
    const cliente = await repo.findOne({ where });
    if (!cliente) {
        return res.status(404).json({ error: "Cliente não encontrado" });
    }
    await repo.remove(cliente);
    return res.status(204).send();
});
