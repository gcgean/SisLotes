"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRetencoesServicos1700000000046 = void 0;
class AddRetencoesServicos1700000000046 {
    constructor() {
        this.name = "AddRetencoesServicos1700000000046";
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE despesa_parcela_pagamentos ADD COLUMN iss_retido numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN irrf_retido numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN inss_retido numeric(12,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE despesa_parcelas ADD COLUMN iss_retido numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN irrf_retido numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN inss_retido numeric(12,2) NOT NULL DEFAULT 0`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE despesa_parcelas DROP COLUMN inss_retido, DROP COLUMN irrf_retido, DROP COLUMN iss_retido`);
        await queryRunner.query(`ALTER TABLE despesa_parcela_pagamentos DROP COLUMN inss_retido, DROP COLUMN irrf_retido, DROP COLUMN iss_retido`);
    }
}
exports.AddRetencoesServicos1700000000046 = AddRetencoesServicos1700000000046;
