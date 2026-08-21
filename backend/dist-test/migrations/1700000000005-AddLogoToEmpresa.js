"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddLogoToEmpresa1700000000005 = void 0;
class AddLogoToEmpresa1700000000005 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE empresas
        ADD COLUMN IF NOT EXISTS logo TEXT,
        ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
        ADD COLUMN IF NOT EXISTS email VARCHAR(200),
        ADD COLUMN IF NOT EXISTS site VARCHAR(200)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE empresas
        DROP COLUMN IF EXISTS logo,
        DROP COLUMN IF EXISTS bairro,
        DROP COLUMN IF EXISTS email,
        DROP COLUMN IF EXISTS site
    `);
    }
}
exports.AddLogoToEmpresa1700000000005 = AddLogoToEmpresa1700000000005;
