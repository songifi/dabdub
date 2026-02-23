import { Injectable } from '@nestjs/common';
import { DataSource, Repository, FindManyOptions } from 'typeorm';
import * as crypto from 'crypto';
import {
  BankDetails,
  Merchant,
  KycStatus,
  MerchantStatus,
} from '../entities/merchant.entity';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.BANK_DETAILS_ENCRYPTION_KEY!; // 64 hex chars = 32 bytes

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error(
      'BANK_DETAILS_ENCRYPTION_KEY must be 64 hex characters (32 bytes)',
    );
  }
  return Buffer.from(KEY_HEX, 'hex');
}

/** AES-256-GCM encrypt; returns `iv:authTag:ciphertext` (all hex). */
export function encryptBankDetails(plain: BankDetails): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(plain);
  const encrypted = Buffer.concat([
    cipher.update(json, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/** Inverse of `encryptBankDetails`. */
export function decryptBankDetails(ciphertext: string): BankDetails {
  const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !dataHex)
    throw new Error('Invalid ciphertext format');
  const key = getKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as BankDetails;
}

@Injectable()
export class MerchantRepository extends Repository<Merchant> {
  constructor(private readonly dataSource: DataSource) {
    super(Merchant, dataSource.createEntityManager());
  }

  // ── Read helpers ─────────────────────────────────────────────────────────

  async findByEmail(email: string): Promise<Merchant | null> {
    return this.findOne({ where: { email } });
  }

  async findByIdWithRelations(id: string): Promise<Merchant | null> {
    return this.findOne({
      where: { id },
      relations: ['user', 'apiKeys', 'webhookConfigurations'],
    });
  }

  async findByKycStatus(
    status: KycStatus,
    options?: FindManyOptions<Merchant>,
  ): Promise<Merchant[]> {
    return this.find({ ...options, where: { kycStatus: status } });
  }

  async findActive(): Promise<Merchant[]> {
    return this.find({ where: { status: MerchantStatus.ACTIVE } });
  }

  // ── Write helpers ─────────────────────────────────────────────────────────

  async createMerchant(
    data: Partial<Merchant>,
    bankDetails?: BankDetails,
  ): Promise<Merchant> {
    const merchant = this.create(data);
    if (bankDetails) {
      merchant.bankDetailsEncrypted = encryptBankDetails(bankDetails);
    }
    return this.save(merchant);
  }

  async updateMerchant(
    id: string,
    data: Partial<Merchant>,
    bankDetails?: BankDetails,
    updatedBy?: string,
  ): Promise<Merchant> {
    const merchant = await this.findOneOrFail({ where: { id } });
    Object.assign(merchant, data);
    if (bankDetails) {
      merchant.bankDetailsEncrypted = encryptBankDetails(bankDetails);
    }
    if (updatedBy) merchant.updatedBy = updatedBy;
    return this.save(merchant);
  }

  /** Soft-delete (sets deletedAt via TypeORM). */
  async softDeleteMerchant(id: string): Promise<void> {
    await this.softDelete(id);
  }

  /** Hard-delete – use only in tests or data-retention flows. */
  async hardDeleteMerchant(id: string): Promise<void> {
    await this.delete(id);
  }

  // ── Bank details ──────────────────────────────────────────────────────────

  getBankDetails(merchant: Merchant): BankDetails | null {
    if (!merchant.bankDetailsEncrypted) return null;
    return decryptBankDetails(merchant.bankDetailsEncrypted);
  }

  async saveBankDetails(
    id: string,
    bankDetails: BankDetails,
  ): Promise<Merchant> {
    const merchant = await this.findOneOrFail({ where: { id } });
    merchant.bankDetailsEncrypted = encryptBankDetails(bankDetails);
    return this.save(merchant);
  }

  // ── KYC ───────────────────────────────────────────────────────────────────

  async approveKyc(id: string, approvedBy: string): Promise<Merchant> {
    return this.updateMerchant(
      id,
      {
        kycStatus: KycStatus.APPROVED,
        kycVerifiedAt: new Date(),
        status: MerchantStatus.ACTIVE,
      },
      undefined,
      approvedBy,
    );
  }

  async rejectKyc(
    id: string,
    reason: string,
    rejectedBy: string,
  ): Promise<Merchant> {
    return this.updateMerchant(
      id,
      {
        kycStatus: KycStatus.REJECTED,
        kycRejectionReason: reason,
      },
      undefined,
      rejectedBy,
    );
  }

  // ── Status transitions ────────────────────────────────────────────────────

  async suspend(id: string, by: string): Promise<Merchant> {
    return this.updateMerchant(
      id,
      { status: MerchantStatus.SUSPENDED, suspendedAt: new Date() },
      undefined,
      by,
    );
  }

  async close(id: string, by: string): Promise<Merchant> {
    return this.updateMerchant(
      id,
      { status: MerchantStatus.CLOSED, closedAt: new Date() },
      undefined,
      by,
    );
  }
}
