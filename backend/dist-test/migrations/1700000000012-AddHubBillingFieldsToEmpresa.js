"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddHubBillingFieldsToEmpresa1700000000012 = void 0;
class AddHubBillingFieldsToEmpresa1700000000012 {
    constructor() {
        this.name = "AddHubBillingFieldsToEmpresa1700000000012";
    }
    async up(queryRunner) {
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
    async down(queryRunner) {
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
exports.AddHubBillingFieldsToEmpresa1700000000012 = AddHubBillingFieldsToEmpresa1700000000012;
