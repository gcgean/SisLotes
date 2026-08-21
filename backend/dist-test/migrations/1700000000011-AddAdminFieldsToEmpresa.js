"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAdminFieldsToEmpresa1700000000011 = void 0;
class AddAdminFieldsToEmpresa1700000000011 {
    constructor() {
        this.name = "AddAdminFieldsToEmpresa1700000000011";
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "plano" varchar(50)`);
        await queryRunner.query(`ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "data_vencimento" date`);
        await queryRunner.query(`ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "ultimo_acesso" timestamp`);
        await queryRunner.query(`ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "observacoes" text`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN IF EXISTS "observacoes"`);
        await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN IF EXISTS "ultimo_acesso"`);
        await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN IF EXISTS "data_vencimento"`);
        await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN IF EXISTS "plano"`);
    }
}
exports.AddAdminFieldsToEmpresa1700000000011 = AddAdminFieldsToEmpresa1700000000011;
