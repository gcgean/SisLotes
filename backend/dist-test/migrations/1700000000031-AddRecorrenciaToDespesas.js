"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRecorrenciaToDespesas1700000000031 = void 0;
class AddRecorrenciaToDespesas1700000000031 {
    constructor() {
        this.name = "AddRecorrenciaToDespesas1700000000031";
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente BOOLEAN NOT NULL DEFAULT FALSE`);
        await queryRunner.query(`ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrencia_ativa BOOLEAN NOT NULL DEFAULT TRUE`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_despesas_recorrente ON despesas(recorrente, recorrencia_ativa)`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_despesas_recorrente`);
        await queryRunner.query(`ALTER TABLE despesas DROP COLUMN IF EXISTS recorrencia_ativa`);
        await queryRunner.query(`ALTER TABLE despesas DROP COLUMN IF EXISTS recorrente`);
    }
}
exports.AddRecorrenciaToDespesas1700000000031 = AddRecorrenciaToDespesas1700000000031;
