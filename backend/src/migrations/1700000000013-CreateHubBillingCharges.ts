import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHubBillingCharges1700000000013 implements MigrationInterface {
  name = "CreateHubBillingCharges1700000000013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hub_billing_charges (
        id_hub_charge SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa) ON DELETE CASCADE,
        origin_type VARCHAR(40) NOT NULL,
        origin_id VARCHAR(100) NOT NULL,
        order_id VARCHAR(100),
        subscription_id VARCHAR(100),
        charge_id VARCHAR(120),
        status VARCHAR(40),
        amount NUMERIC(12,2),
        payload JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_hub_charge_empresa ON hub_billing_charges(id_empresa)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_hub_charge_charge_id ON hub_billing_charges(charge_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS hub_billing_charges`);
  }
}

