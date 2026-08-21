"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddEncargosToEmpresa1700000000022 = void 0;
class AddEncargosToEmpresa1700000000022 {
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS multa_percentual NUMERIC(5,2) NOT NULL DEFAULT 2.00`);
        await queryRunner.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS juros_percentual_dia NUMERIC(5,4) NOT NULL DEFAULT 0.2000`);
        await queryRunner.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS carencia_dias INTEGER NOT NULL DEFAULT 0`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE empresas DROP COLUMN IF EXISTS multa_percentual`);
        await queryRunner.query(`ALTER TABLE empresas DROP COLUMN IF EXISTS juros_percentual_dia`);
        await queryRunner.query(`ALTER TABLE empresas DROP COLUMN IF EXISTS carencia_dias`);
    }
}
exports.AddEncargosToEmpresa1700000000022 = AddEncargosToEmpresa1700000000022;
