import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateMerchantDocumentTables1771800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create merchant_documents table
        await queryRunner.createTable(new Table({
            name: "merchant_documents",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "uuid"
                },
                {
                    name: "merchant_id",
                    type: "uuid",
                    isNullable: false
                },
                {
                    name: "document_type",
                    type: "enum",
                    enum: [
                        "BUSINESS_REGISTRATION",
                        "CERTIFICATE_OF_INCORPORATION",
                        "MEMORANDUM_OF_ASSOCIATION",
                        "DIRECTORS_ID",
                        "DIRECTORS_PROOF_OF_ADDRESS",
                        "UTILITY_BILL",
                        "BANK_STATEMENT",
                        "TAX_CERTIFICATE",
                        "PEP_DECLARATION",
                        "SANCTIONS_DECLARATION",
                        "BENEFICIAL_OWNER_FORM"
                    ],
                    isNullable: false
                },
                {
                    name: "original_filename",
                    type: "varchar",
                    isNullable: false
                },
                {
                    name: "mime_type",
                    type: "varchar",
                    isNullable: false
                },
                {
                    name: "file_size_bytes",
                    type: "bigint",
                    isNullable: false
                },
                {
                    name: "s3_key",
                    type: "varchar",
                    isNullable: false
                },
                {
                    name: "status",
                    type: "enum",
                    enum: ["UPLOADED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "EXPIRED", "SUPERSEDED"],
                    default: "'UPLOADED'"
                },
                {
                    name: "rejection_reason",
                    type: "text",
                    isNullable: true
                },
                {
                    name: "reviewed_by_id",
                    type: "uuid",
                    isNullable: true
                },
                {
                    name: "reviewed_at",
                    type: "timestamptz",
                    isNullable: true
                },
                {
                    name: "document_expires_at",
                    type: "timestamptz",
                    isNullable: true
                },
                {
                    name: "expiry_alert_sent_at",
                    type: "timestamptz",
                    isNullable: true
                },
                {
                    name: "version",
                    type: "int",
                    default: 1
                },
                {
                    name: "created_at",
                    type: "timestamptz",
                    default: "now()"
                },
                {
                    name: "updated_at",
                    type: "timestamptz",
                    default: "now()"
                },
                {
                    name: "deleted_at",
                    type: "timestamptz",
                    isNullable: true
                }
            ]
        }), true);

        // Create merchant_document_requests table
        await queryRunner.createTable(new Table({
            name: "merchant_document_requests",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "uuid"
                },
                {
                    name: "merchant_id",
                    type: "uuid",
                    isNullable: false
                },
                {
                    name: "document_type",
                    type: "enum",
                    enum: [
                        "BUSINESS_REGISTRATION",
                        "CERTIFICATE_OF_INCORPORATION",
                        "MEMORANDUM_OF_ASSOCIATION",
                        "DIRECTORS_ID",
                        "DIRECTORS_PROOF_OF_ADDRESS",
                        "UTILITY_BILL",
                        "BANK_STATEMENT",
                        "TAX_CERTIFICATE",
                        "PEP_DECLARATION",
                        "SANCTIONS_DECLARATION",
                        "BENEFICIAL_OWNER_FORM"
                    ],
                    isNullable: false
                },
                {
                    name: "message",
                    type: "text",
                    isNullable: false
                },
                {
                    name: "deadline",
                    type: "timestamptz",
                    isNullable: true
                },
                {
                    name: "status",
                    type: "enum",
                    enum: ["PENDING", "FULFILLED", "CANCELLED"],
                    default: "'PENDING'"
                },
                {
                    name: "created_at",
                    type: "timestamptz",
                    default: "now()"
                },
                {
                    name: "updated_at",
                    type: "timestamptz",
                    default: "now()"
                },
                {
                    name: "deleted_at",
                    type: "timestamptz",
                    isNullable: true
                }
            ]
        }), true);

        // Add Foreign Keys
        await queryRunner.createForeignKeys("merchant_documents", [
            new TableForeignKey({
                columnNames: ["merchant_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "merchants",
                onDelete: "CASCADE"
            })
        ]);

        await queryRunner.createForeignKeys("merchant_document_requests", [
            new TableForeignKey({
                columnNames: ["merchant_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "merchants",
                onDelete: "CASCADE"
            })
        ]);

        // Add Indexes
        await queryRunner.createIndices("merchant_documents", [
            new TableIndex({ name: "idx_merchant_documents_merchant_id", columnNames: ["merchant_id"] }),
            new TableIndex({ name: "idx_merchant_documents_status", columnNames: ["status"] }),
            new TableIndex({ name: "idx_merchant_documents_type", columnNames: ["document_type"] }),
            new TableIndex({ name: "idx_merchant_documents_expiry", columnNames: ["document_expires_at"] })
        ]);

        await queryRunner.createIndices("merchant_document_requests", [
            new TableIndex({ name: "idx_document_requests_merchant_id", columnNames: ["merchant_id"] }),
            new TableIndex({ name: "idx_document_requests_status", columnNames: ["status"] })
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("merchant_document_requests");
        await queryRunner.dropTable("merchant_documents");
        // Drop Enums if they were explicitly created as Postgres types, 
        // but TypeORM usually handles them as part of the table if defined in enum array.
    }
}
