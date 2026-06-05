import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReajustadoToPagamentos1700000000020 implements MigrationInterface {
  name = "AddReajustadoToPagamentos1700000000020";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS reajustado BOOLEAN NOT NULL DEFAULT FALSE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE pagamentos DROP COLUMN IF EXISTS reajustado`
    );
  }
}
