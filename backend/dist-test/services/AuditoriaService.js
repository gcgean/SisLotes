"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditoriaService = void 0;
const data_source_1 = require("../db/data-source");
const Auditoria_1 = require("../entities/Auditoria");
class AuditoriaService {
    static async registrar(req, tabela, acao, id_registro, valores_antigos, valores_novos, descricao) {
        try {
            const auditoriaRepo = data_source_1.AppDataSource.getRepository(Auditoria_1.Auditoria);
            const ip_address = req.ip || req.headers["x-forwarded-for"]?.split(",")[0];
            const auditoria = auditoriaRepo.create({
                id_usuario: req.user?.id_usuario ?? 1,
                tabela,
                id_registro,
                acao,
                valores_antigos,
                valores_novos,
                descricao,
                ip_address: ip_address?.trim(),
                id_empresa: req.user?.id_empresa,
            });
            await auditoriaRepo.save(auditoria);
        }
        catch (error) {
            console.error("[Auditoria] Erro ao registrar:", error);
        }
    }
    static async registrarVenda(req, acao, id_venda, descricao, valores) {
        await this.registrar(req, "vendas", acao, id_venda, undefined, valores, descricao);
    }
    static async registrarPagamento(req, acao, id_pagamento, descricao, valores) {
        await this.registrar(req, "pagamentos", acao, id_pagamento, undefined, valores, descricao);
    }
    static async registrarCliente(req, acao, id_cliente, descricao, valores) {
        await this.registrar(req, "clientes", acao, id_cliente, undefined, valores, descricao);
    }
    static async registrarLote(req, acao, id_lote, descricao, valores) {
        await this.registrar(req, "lotes", acao, id_lote, undefined, valores, descricao);
    }
}
exports.AuditoriaService = AuditoriaService;
