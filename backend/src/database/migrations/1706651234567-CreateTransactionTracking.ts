import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTransactionTracking1706651234567 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Status and Type Enums
        await queryRunner.query(`CREATE TYPE "transaction_status_enum" AS ENUM('pending', 'confirmed', 'failed', 'replaced')`);
        await queryRunner.query(`CREATE TYPE "transaction_type_enum" AS ENUM('deposit', 'settlement', 'refund')`);

        // Create Transactions Table with all fields from Issue Description
        await queryRunner.query(`
            CREATE TABLE "transactions" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "payment_request_id" uuid NOT NULL,
                "tx_hash" varchar UNIQUE NOT NULL,
                "network" varchar(50) NOT NULL,
                "from_address" varchar NOT NULL,
                "to_address" varchar NOT NULL,
                "type" "transaction_type_enum" NOT NULL,
                "status" "transaction_status_enum" DEFAULT 'pending',
                "crypto_amount" decimal(36,18) NOT NULL,
                "usd_value" decimal(18,2),
                "fiat_amount" decimal(18,2),
                "confirmations" int DEFAULT 0,
                "required_confirmations" int DEFAULT 12,
                "block_number" bigint,
                "block_timestamp" timestamp,
                "fee_amount" decimal(36,18),
                "receipt" jsonb,
                "metadata" jsonb,
                "retry_count" int DEFAULT 0,
                "error_message" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "confirmed_at" timestamp,
                CONSTRAINT "FK_transactions_payment_request" 
                    FOREIGN KEY ("payment_request_id") 
                    REFERENCES "payment_requests"("id") ON DELETE CASCADE
            )
        `);

        // Create required indexes for performance
        await queryRunner.query(`CREATE INDEX "IDX_transactions_tx_hash" ON "transactions" ("tx_hash")`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_network" ON "transactions" ("network")`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_status" ON "transactions" ("status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
        await queryRunner.query(`DROP TYPE "transaction_type_enum"`);
    }
}