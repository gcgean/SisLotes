"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateHubBillingEvents1700000000014 = void 0;
class CreateHubBillingEvents1700000000014 {
    constructor() {
        this.name = "CreateHubBillingEvents1700000000014";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hub_billing_events (
        id_hub_event SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa) ON DELETE CASCADE,
        event_type VARCHAR(80) NOT NULL,
        event_source VARCHAR(30) NOT NULL,
        charge_id VARCHAR(120),
        order_id VARCHAR(120),
        subscription_id VARCHAR(120),
        status VARCHAR(40),
        amount NUMERIC(12,2),
        payload JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_hub_event_empresa ON hub_billing_events(id_empresa)
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_hub_event_charge_id ON hub_billing_events(charge_id)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS hub_billing_events`);
    }
}
exports.CreateHubBillingEvents1700000000014 = CreateHubBillingEvents1700000000014;
