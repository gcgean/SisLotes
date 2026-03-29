import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminFieldsToEmpresa1700000000011 implements MigrationInterface {
  name = "AddAdminFieldsToEmpresa1700000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "plano" varchar(50)`);
    await queryRunner.query(`ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "data_vencimento" date`);
    await queryRunner.query(`ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "ultimo_acesso" timestamp`);
    await queryRunner.query(`ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "observacoes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN IF EXISTS "observacoes"`);
    await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN IF EXISTS "ultimo_acesso"`);
    await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN IF EXISTS "data_vencimento"`);
    await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN IF EXISTS "plano"`);
  }
}
