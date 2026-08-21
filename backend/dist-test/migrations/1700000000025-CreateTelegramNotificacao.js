"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTelegramNotificacao1700000000025 = void 0;
class CreateTelegramNotificacao1700000000025 {
    constructor() {
        this.name = "CreateTelegramNotificacao1700000000025";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS telegram_notificacao (
        id SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        tipo VARCHAR(40) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_telegram_notificacao UNIQUE (id_empresa, tipo)
      )
    `);
        await queryRunner.query(`ALTER TABLE telegram_config ADD COLUMN IF NOT EXISTS notificar_trial BOOLEAN NOT NULL DEFAULT TRUE`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS telegram_notificacao`);
        await queryRunner.query(`ALTER TABLE telegram_config DROP COLUMN IF EXISTS notificar_trial`);
    }
}
exports.CreateTelegramNotificacao1700000000025 = CreateTelegramNotificacao1700000000025;
