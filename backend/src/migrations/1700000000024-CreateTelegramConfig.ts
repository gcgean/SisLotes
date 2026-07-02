import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTelegramConfig1700000000024 implements MigrationInterface {
  name = "CreateTelegramConfig1700000000024";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS telegram_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        ativo BOOLEAN NOT NULL DEFAULT FALSE,
        bot_token TEXT,
        notificar_novo_lead BOOLEAN NOT NULL DEFAULT TRUE,
        recipients JSONB,
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT telegram_config_single_row CHECK (id = 1)
      )
    `);

    // Garante a linha única de configuração
    await queryRunner.query(`
      INSERT INTO telegram_config (id, ativo, notificar_novo_lead)
      VALUES (1, FALSE, TRUE)
      ON CONFLICT (id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS telegram_config`);
  }
}
