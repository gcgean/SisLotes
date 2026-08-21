"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddModeloContratoToEmpresa1700000000017 = void 0;
class AddModeloContratoToEmpresa1700000000017 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE empresas
        ADD COLUMN IF NOT EXISTS modelo_contrato TEXT
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE empresas
        DROP COLUMN IF EXISTS modelo_contrato
    `);
    }
}
exports.AddModeloContratoToEmpresa1700000000017 = AddModeloContratoToEmpresa1700000000017;
