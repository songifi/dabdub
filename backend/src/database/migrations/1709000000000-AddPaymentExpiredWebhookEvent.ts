import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentExpiredWebhookEvent1709000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update the enum type to include the new payment.expired event
    await queryRunner.query(`
      ALTER TYPE webhook_event_enum ADD VALUE IF NOT EXISTS 'payment.expired';
    `);

    // Optional: Update existing webhook configurations to include the new event
    // Uncomment if you want to auto-subscribe all webhooks to expiry events
    /*
    await queryRunner.query(`
      UPDATE webhook_configurations
      SET events = array_append(events, 'payment.expired')
      WHERE 'payment_request.created' = ANY(events)
        AND NOT 'payment.expired' = ANY(events);
    `);
    */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the event from all webhook configurations
    await queryRunner.query(`
      UPDATE webhook_configurations
      SET events = array_remove(events, 'payment.expired')
      WHERE 'payment.expired' = ANY(events);
    `);

    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type to remove the value
    // This is typically not done in production as it can cause issues
  }
}
