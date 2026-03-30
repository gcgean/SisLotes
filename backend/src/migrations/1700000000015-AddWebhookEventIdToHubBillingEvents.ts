import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWebhookEventIdToHubBillingEvents1700000000015 implements MigrationInterface {
  name = "AddWebhookEventIdToHubBillingEvents1700000000015";

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_hub_event_webhook_event_id`);
    await queryRunner.query(`ALTER TABLE hub_billing_events DROP COLUMN IF EXISTS webhook_event_id`);
  }
}
