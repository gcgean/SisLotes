import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIgnorePlanControlToEmpresa1700000000016 implements MigrationInterface {
  name = "AddIgnorePlanControlToEmpresa1700000000016";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE empresas
      ADD COLUMN IF NOT EXISTS ignorar_controle_planos BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE empresas
      DROP COLUMN IF EXISTS ignorar_controle_planos
    `);
  }
}

