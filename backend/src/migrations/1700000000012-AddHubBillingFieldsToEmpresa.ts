import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHubBillingFieldsToEmpresa1700000000012 implements MigrationInterface {
  name = "AddHubBillingFieldsToEmpresa1700000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE empresas
      ADD COLUMN IF NOT EXISTS hub_customer_id VARCHAR(80),
      ADD COLUMN IF NOT EXISTS hub_product_code VARCHAR(80),
      ADD COLUMN IF NOT EXISTS hub_license_status VARCHAR(40),
      ADD COLUMN IF NOT EXISTS hub_license_reason VARCHAR(80),
      ADD COLUMN IF NOT EXISTS hub_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS hub_features JSONB,
      ADD COLUMN IF NOT EXISTS hub_last_sync TIMESTAMP,
      ADD COLUMN IF NOT EXISTS hub_cache_until TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE empresas
      DROP COLUMN IF EXISTS hub_cache_until,
      DROP COLUMN IF EXISTS hub_last_sync,
      DROP COLUMN IF EXISTS hub_features,
      DROP COLUMN IF EXISTS hub_expires_at,
      DROP COLUMN IF EXISTS hub_license_reason,
      DROP COLUMN IF EXISTS hub_license_status,
      DROP COLUMN IF EXISTS hub_product_code,
      DROP COLUMN IF EXISTS hub_customer_id
    `);
  }
}

