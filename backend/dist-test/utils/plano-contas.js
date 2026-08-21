"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contaContabilAceitaLancamento = contaContabilAceitaLancamento;
const data_source_1 = require("../db/data-source");
async function contaContabilAceitaLancamento(idContaContabil, idEmpresa, tipo) {
    const params = [idContaContabil, idEmpresa];
    const tipoClause = tipo ? (params.push(tipo), `AND conta.tipo = $${params.length}`) : "";
    const rows = await data_source_1.AppDataSource.query(`SELECT EXISTS (
       SELECT 1
       FROM plano_de_contas conta
       WHERE conta.id_conta_contabil = $1
         AND conta.id_empresa = $2
         AND conta.ativo = true
         ${tipoClause}
         AND NOT EXISTS (
           SELECT 1 FROM plano_de_contas filha
           WHERE filha.id_pai = conta.id_conta_contabil
             AND filha.id_empresa = conta.id_empresa
         )
     ) AS aceita`, params);
    return rows[0]?.aceita === true;
}
