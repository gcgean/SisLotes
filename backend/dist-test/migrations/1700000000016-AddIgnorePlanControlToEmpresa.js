"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddIgnorePlanControlToEmpresa1700000000016 = void 0;
class AddIgnorePlanControlToEmpresa1700000000016 {
    constructor() {
        this.name = "AddIgnorePlanControlToEmpresa1700000000016";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE empresas
      ADD COLUMN IF NOT EXISTS ignorar_controle_planos BOOLEAN NOT NULL DEFAULT false
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE empresas
      DROP COLUMN IF EXISTS ignorar_controle_planos
    `);
    }
}
exports.AddIgnorePlanControlToEmpresa1700000000016 = AddIgnorePlanControlToEmpresa1700000000016;
