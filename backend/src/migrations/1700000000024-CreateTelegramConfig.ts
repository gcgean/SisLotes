import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTelegramConfig1700000000024 implements MigrationInterface {
  name = "CreateTelegramConfig1700000000024";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Auto-correção: remove um TYPE "telegram_config" órfão (resíduo de tentativa
    // anterior interrompida) que impediria o CREATE TABLE — mas apenas se NÃO
    // existir uma tabela real com esse nome (para não apagar dados existentes).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'telegram_config' AND n.nspname = 'public'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'telegram_config' AND n.nspname = 'public' AND c.relkind IN ('r', 'p')
        ) THEN
          DROP TYPE IF EXISTS public.telegram_config CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS telegram_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        ativo BOOLEAN NOT NULL DEFAULT FALSE,
        bot_token TEXT,
        notificar_novo_lead BOOLEAN NOT NULL DEFAULT TRUE,
        notificar_pagamento BOOLEAN NOT NULL DEFAULT TRUE,
        recipients JSONB,
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT telegram_config_single_row CHECK (id = 1)
      )
    `);

    // Idempotente: garante a coluna caso a tabela já existisse
    await queryRunner.query(
      `ALTER TABLE telegram_config ADD COLUMN IF NOT EXISTS notificar_pagamento BOOLEAN NOT NULL DEFAULT TRUE`
    );

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
