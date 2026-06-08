import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEncargosToEmpresa1700000000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS multa_percentual NUMERIC(5,2) NOT NULL DEFAULT 2.00`);
    await queryRunner.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS juros_percentual_dia NUMERIC(5,4) NOT NULL DEFAULT 0.2000`);
    await queryRunner.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS carencia_dias INTEGER NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE empresas DROP COLUMN IF EXISTS multa_percentual`);
    await queryRunner.query(`ALTER TABLE empresas DROP COLUMN IF EXISTS juros_percentual_dia`);
    await queryRunner.query(`ALTER TABLE empresas DROP COLUMN IF EXISTS carencia_dias`);
  }
}
