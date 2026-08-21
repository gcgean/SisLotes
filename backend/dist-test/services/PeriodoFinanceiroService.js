"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificarPeriodoFinanceiro = verificarPeriodoFinanceiro;
exports.verificarPeriodoFinanceiroContas = verificarPeriodoFinanceiroContas;
exports.verificarPermissaoRetroativa = verificarPermissaoRetroativa;
const data_source_1 = require("../db/data-source");
async function verificarPeriodoFinanceiro(idEmpresa, data, idConta) { if (!data)
    return null; const [r] = await data_source_1.AppDataSource.query(`SELECT TO_CHAR(MAX(f.fechado_ate),'YYYY-MM-DD') fechado_ate,BOOL_OR(f.id_conta IS NULL) FILTER(WHERE f.fechado_ate=(SELECT MAX(f2.fechado_ate) FROM fechamentos_financeiros f2 WHERE f2.id_empresa=$1 AND (f2.id_conta IS NULL OR f2.id_conta=$2))) global FROM fechamentos_financeiros f WHERE f.id_empresa=$1 AND (f.id_conta IS NULL OR f.id_conta=$2)`, [idEmpresa, idConta ?? null]); if (r?.fechado_ate && data <= r.fechado_ate)
    return `Período financeiro fechado até ${r.fechado_ate} (${r.global ? "todas as contas" : "conta selecionada"}). Não é permitido alterar movimentos nesta data.`; return null; }
async function verificarPeriodoFinanceiroContas(idEmpresa, data, idsContas) { for (const idConta of new Set(idsContas.filter((id) => Number.isInteger(id)))) {
    const bloqueio = await verificarPeriodoFinanceiro(idEmpresa, data, idConta);
    if (bloqueio)
        return bloqueio;
} return null; }
async function verificarPermissaoRetroativa(usuario, data) { if (!data || usuario.user_master || usuario.financeiro_lancar_retroativo)
    return null; const [r] = await data_source_1.AppDataSource.query(`SELECT TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') hoje`); return data < r.hoje ? "Usuário sem permissão para lançar ou alterar movimentos em data retroativa." : null; }
