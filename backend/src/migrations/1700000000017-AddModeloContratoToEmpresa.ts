import { MigrationInterface, QueryRunner } from "typeorm";

export class AddModeloContratoToEmpresa1700000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE empresas
        ADD COLUMN IF NOT EXISTS modelo_contrato TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE empresas
        DROP COLUMN IF EXISTS modelo_contrato
    `);
  }
}
