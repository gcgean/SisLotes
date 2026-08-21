"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixAllSequences1700000000018 = void 0;
/**
 * Corrige as sequences de todas as tabelas que receberam dados migrados do MySQL.
 * Quando dados são inseridos com IDs explícitos, o SERIAL/sequence do PostgreSQL
 * não é atualizado automaticamente, causando "duplicate key" nos próximos INSERTs.
 */
class FixAllSequences1700000000018 {
    constructor() {
        this.name = "FixAllSequences1700000000018";
    }
    async up(queryRunner) {
        const tables = [
            { table: "clientes", pk: "id_cliente" },
            { table: "loteamentos", pk: "id_loteamento" },
            { table: "lotes", pk: "id_lote" },
            { table: "vendas", pk: "id_venda" },
            { table: "pagamentos", pk: "id_pagamento" },
            { table: "contas", pk: "id_conta" },
            { table: "usuarios", pk: "id_usuario" },
        ];
        for (const { table, pk } of tables) {
            await queryRunner.query(`
        SELECT setval(
          pg_get_serial_sequence('${table}', '${pk}'),
          COALESCE(MAX(${pk}), 1)
        )
        FROM ${table}
      `);
        }
    }
    async down(_queryRunner) {
        // Não é possível reverter o ajuste de sequence de forma segura
    }
}
exports.FixAllSequences1700000000018 = FixAllSequences1700000000018;
