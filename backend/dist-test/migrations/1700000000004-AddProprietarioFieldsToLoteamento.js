"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddProprietarioFieldsToLoteamento1700000000004 = void 0;
class AddProprietarioFieldsToLoteamento1700000000004 {
    constructor() {
        this.name = "AddProprietarioFieldsToLoteamento1700000000004";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE loteamentos 
      ADD COLUMN rg VARCHAR(20),
      ADD COLUMN estado_civil VARCHAR(50),
      ADD COLUMN conjuge VARCHAR(200),
      ADD COLUMN profissao VARCHAR(100)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE loteamentos 
      DROP COLUMN rg,
      DROP COLUMN estado_civil,
      DROP COLUMN conjuge,
      DROP COLUMN profissao
    `);
    }
}
exports.AddProprietarioFieldsToLoteamento1700000000004 = AddProprietarioFieldsToLoteamento1700000000004;
