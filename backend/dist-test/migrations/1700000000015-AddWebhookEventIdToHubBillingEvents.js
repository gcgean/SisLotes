"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddWebhookEventIdToHubBillingEvents1700000000015 = void 0;
class AddWebhookEventIdToHubBillingEvents1700000000015 {
    constructor() {
        this.name = "AddWebhookEventIdToHubBillingEvents1700000000015";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE hub_billing_events
      ADD COLUMN IF NOT EXISTS webhook_event_id VARCHAR(120) NULL
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_event_webhook_event_id
      ON hub_billing_events(webhook_event_id)
      WHERE webhook_event_id IS NOT NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_hub_event_webhook_event_id`);
        await queryRunner.query(`ALTER TABLE hub_billing_events DROP COLUMN IF EXISTS webhook_event_id`);
    }
}
exports.AddWebhookEventIdToHubBillingEvents1700000000015 = AddWebhookEventIdToHubBillingEvents1700000000015;
