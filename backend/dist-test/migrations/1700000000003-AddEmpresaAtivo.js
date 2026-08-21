"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddEmpresaAtivo1700000000003 = void 0;
class AddEmpresaAtivo1700000000003 {
    constructor() {
        this.name = "AddEmpresaAtivo1700000000003";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE empresas
      ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true
    `);
        await queryRunner.query(`
      UPDATE empresas
      SET ativo = true
      WHERE ativo IS NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE empresas
      DROP COLUMN IF EXISTS ativo
    `);
    }
}
exports.AddEmpresaAtivo1700000000003 = AddEmpresaAtivo1700000000003;
