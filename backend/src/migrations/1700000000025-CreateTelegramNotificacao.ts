import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTelegramNotificacao1700000000025 implements MigrationInterface {
  name = "CreateTelegramNotificacao1700000000025";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS telegram_notificacao (
        id SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        tipo VARCHAR(40) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_telegram_notificacao UNIQUE (id_empresa, tipo)
      )
    `);

    await queryRunner.query(
      `ALTER TABLE telegram_config ADD COLUMN IF NOT EXISTS notificar_trial BOOLEAN NOT NULL DEFAULT TRUE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS telegram_notificacao`);
    await queryRunner.query(`ALTER TABLE telegram_config DROP COLUMN IF EXISTS notificar_trial`);
  }
}
