"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditoriaRouter = void 0;
const express_1 = require("express");
const data_source_1 = require("../../db/data-source");
const Auditoria_1 = require("../../entities/Auditoria");
const auth_1 = require("../../middleware/auth");
exports.auditoriaRouter = (0, express_1.Router)();
exports.auditoriaRouter.use(auth_1.requireAuth, (0, auth_1.requireFeature)("module_auditoria"));
exports.auditoriaRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const { tabela, acao, busca, id_usuario, data_inicio, data_fim, limit = 100, offset = 0 } = req.query;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida" });
    }
    const auditoriaRepo = data_source_1.AppDataSource.getRepository(Auditoria_1.Auditoria);
    const queryBuilder = auditoriaRepo
        .createQueryBuilder("a")
        .leftJoinAndSelect("a.usuario", "usuario")
        .where("a.id_empresa = :id_empresa", { id_empresa: idEmpresa });
    if (tabela) {
        queryBuilder.andWhere("a.tabela = :tabela", { tabela });
    }
    if (acao) {
        queryBuilder.andWhere("a.acao = :acao", { acao });
    }
    if (typeof busca === "string" && busca.trim()) {
        queryBuilder.andWhere("a.descricao ILIKE :busca", { busca: `%${busca.trim()}%` });
    }
    if (id_usuario) {
        queryBuilder.andWhere("a.id_usuario = :id_usuario", { id_usuario });
    }
    if (data_inicio) {
        queryBuilder.andWhere("a.data_hora >= :data_inicio", { data_inicio });
    }
    if (data_fim) {
        queryBuilder.andWhere("a.data_hora <= :data_fim", { data_fim });
    }
    const [dados, total] = await queryBuilder
        .orderBy("a.data_hora", "DESC")
        .limit(Number(limit))
        .offset(Number(offset))
        .getManyAndCount();
    return res.json({
        dados: dados.map((a) => ({
            id_auditoria: a.id_auditoria,
            usuario: a.usuario?.login || "desconhecido",
            tabela: a.tabela,
            id_registro: a.id_registro,
            acao: a.acao,
            descricao: a.descricao,
            ip_address: a.ip_address,
            data_hora: a.data_hora,
            valores_antigos: a.valores_antigos,
            valores_novos: a.valores_novos,
        })),
        total,
        limit: Number(limit),
        offset: Number(offset),
    });
});
exports.auditoriaRouter.get("/usuario/:id_usuario", auth_1.requireAuth, async (req, res) => {
    const { id_usuario } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const idEmpresa = req.user?.id_empresa;
    if (!idEmpresa) {
        return res.status(400).json({ error: "Empresa não definida" });
    }
    const auditoriaRepo = data_source_1.AppDataSource.getRepository(Auditoria_1.Auditoria);
    const [dados, total] = await auditoriaRepo
        .createQueryBuilder("a")
        .leftJoinAndSelect("a.usuario", "usuario")
        .where("a.id_usuario = :id_usuario", { id_usuario: Number(id_usuario) })
        .andWhere("a.id_empresa = :id_empresa", { id_empresa: idEmpresa })
        .orderBy("a.data_hora", "DESC")
        .limit(Number(limit))
        .offset(Number(offset))
        .getManyAndCount();
    return res.json({
        dados: dados.map((a) => ({
            id_auditoria: a.id_auditoria,
            usuario: a.usuario?.login,
            tabela: a.tabela,
            id_registro: a.id_registro,
            acao: a.acao,
            descricao: a.descricao,
            data_hora: a.data_hora,
        })),
        total,
    });
});
