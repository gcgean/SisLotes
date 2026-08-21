"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddEmailTelefoneToUsuario1700000000008 = void 0;
class AddEmailTelefoneToUsuario1700000000008 {
    constructor() {
        this.name = "AddEmailTelefoneToUsuario1700000000008";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS email VARCHAR(200) UNIQUE,
        ADD COLUMN IF NOT EXISTS telefone VARCHAR(20)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE usuarios
        DROP COLUMN IF EXISTS email,
        DROP COLUMN IF EXISTS telefone
    `);
    }
}
exports.AddEmailTelefoneToUsuario1700000000008 = AddEmailTelefoneToUsuario1700000000008;
