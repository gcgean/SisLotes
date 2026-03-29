import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHubBillingEvents1700000000014 implements MigrationInterface {
  name = "CreateHubBillingEvents1700000000014";

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS hub_billing_events`);
  }
}

