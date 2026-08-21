"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const Log_1 = require("../../entities/Log");
const auth_1 = require("../../middleware/auth");
exports.logsRouter = (0, express_1.Router)();
const listLogsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    id_usuario: zod_1.z.coerce.number().int().positive().optional(),
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
});
exports.logsRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const parseResult = listLogsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
    }
    const { page, limit, id_usuario, from, to } = parseResult.data;
    const repo = data_source_1.AppDataSource.getRepository(Log_1.Log);
    const qb = repo
        .createQueryBuilder("log")
        .leftJoinAndSelect("log.usuario", "usuario")
        .orderBy("log.data_hora", "DESC")
        .skip((page - 1) * limit)
        .take(limit);
    if (req.user?.id_empresa) {
        qb.andWhere("usuario.id_empresa = :id_empresa", {
            id_empresa: req.user.id_empresa,
        });
    }
    if (id_usuario) {
        qb.andWhere("log.id_usuario = :id_usuario", { id_usuario });
    }
    if (from) {
        qb.andWhere("log.data_hora >= :from", { from });
    }
    if (to) {
        qb.andWhere("log.data_hora <= :to", { to });
    }
    const [data, total] = await qb.getManyAndCount();
    return res.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    });
});
