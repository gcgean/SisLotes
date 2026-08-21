"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddComprovantesFinanceiros1700000000045 = void 0;
class AddComprovantesFinanceiros1700000000045 {
    constructor() {
        this.name = "AddComprovantesFinanceiros1700000000045";
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE lancamentos_manuais ADD COLUMN anexo_nome VARCHAR(200), ADD COLUMN anexo_base64 TEXT`);
        await queryRunner.query(`ALTER TABLE despesa_parcela_pagamentos ADD COLUMN anexo_nome VARCHAR(200), ADD COLUMN anexo_base64 TEXT`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE despesa_parcela_pagamentos DROP COLUMN anexo_base64, DROP COLUMN anexo_nome`);
        await queryRunner.query(`ALTER TABLE lancamentos_manuais DROP COLUMN anexo_base64, DROP COLUMN anexo_nome`);
    }
}
exports.AddComprovantesFinanceiros1700000000045 = AddComprovantesFinanceiros1700000000045;
