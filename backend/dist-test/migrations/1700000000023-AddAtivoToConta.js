"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAtivoToConta1700000000023 = void 0;
class AddAtivoToConta1700000000023 {
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE contas ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE contas DROP COLUMN IF EXISTS ativo`);
    }
}
exports.AddAtivoToConta1700000000023 = AddAtivoToConta1700000000023;
