import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmpresaAtivo1700000000003 implements MigrationInterface {
  name = "AddEmpresaAtivo1700000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE empresas
      DROP COLUMN IF EXISTS ativo
    `);
  }
}

