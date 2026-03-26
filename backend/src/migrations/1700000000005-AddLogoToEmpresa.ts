import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLogoToEmpresa1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE empresas
        ADD COLUMN IF NOT EXISTS logo TEXT,
        ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
        ADD COLUMN IF NOT EXISTS email VARCHAR(200),
        ADD COLUMN IF NOT EXISTS site VARCHAR(200)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE empresas
        DROP COLUMN IF EXISTS logo,
        DROP COLUMN IF EXISTS bairro,
        DROP COLUMN IF EXISTS email,
        DROP COLUMN IF EXISTS site
    `);
  }
}
