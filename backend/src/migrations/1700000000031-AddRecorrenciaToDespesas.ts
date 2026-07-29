import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecorrenciaToDespesas1700000000031 implements MigrationInterface {
  name = "AddRecorrenciaToDespesas1700000000031";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente BOOLEAN NOT NULL DEFAULT FALSE`
    );
    await queryRunner.query(
      `ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrencia_ativa BOOLEAN NOT NULL DEFAULT TRUE`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_despesas_recorrente ON despesas(recorrente, recorrencia_ativa)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_despesas_recorrente`);
    await queryRunner.query(`ALTER TABLE despesas DROP COLUMN IF EXISTS recorrencia_ativa`);
    await queryRunner.query(`ALTER TABLE despesas DROP COLUMN IF EXISTS recorrente`);
  }
}
