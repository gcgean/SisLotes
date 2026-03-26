import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailTelefoneToUsuario1700000000008 implements MigrationInterface {
  name = "AddEmailTelefoneToUsuario1700000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS email VARCHAR(200) UNIQUE,
        ADD COLUMN IF NOT EXISTS telefone VARCHAR(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usuarios
        DROP COLUMN IF EXISTS email,
        DROP COLUMN IF EXISTS telefone
    `);
  }
}
