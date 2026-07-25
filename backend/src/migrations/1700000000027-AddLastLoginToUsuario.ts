import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLastLoginToUsuario1700000000027 implements MigrationInterface {
  name = "AddLastLoginToUsuario1700000000027";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN IF EXISTS last_login_at`);
  }
}
