import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTED_PREFIX = 'encv1';
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

@Injectable()
export class EncryptionService {
  private static singleton: EncryptionService | null = null;
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor() {
    this.key = this.resolveKey();
    EncryptionService.singleton = this;
  }

  static getSingleton(): EncryptionService {
    if (!EncryptionService.singleton) {
      EncryptionService.singleton = new EncryptionService();
    }
    return EncryptionService.singleton;
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    const iv = randomBytes(GCM_IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      ENCRYPTED_PREFIX,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) return ciphertext;
    if (!ciphertext.startsWith(`${ENCRYPTED_PREFIX}:`)) {
      return ciphertext;
    }

    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted payload format');
    }
    const [prefix, ivB64, tagB64, payloadB64] = parts;
    if (prefix !== ENCRYPTED_PREFIX || !ivB64 || !tagB64 || !payloadB64) {
      throw new Error('Invalid encrypted payload format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const payload = Buffer.from(payloadB64, 'base64');

    if (iv.length !== GCM_IV_BYTES || authTag.length !== GCM_TAG_BYTES) {
      throw new Error('Invalid encrypted payload components');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(payload),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  decryptLegacy(ciphertext: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const [authTagHex, encryptedHex] = ciphertext.split(':');
    if (!authTagHex || !encryptedHex) {
      throw new Error('Invalid legacy encrypted payload');
    }

    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  logDecryptionFailure(fieldName: string, error: unknown): void {
    this.logger.error(
      `[SECURITY_EVENT] Failed to decrypt "${fieldName}"`,
      error instanceof Error ? error.stack : String(error),
    );
  }

  private resolveKey(): Buffer {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) {
      throw new Error('ENCRYPTION_KEY is not set');
    }

    const utf8Key = Buffer.from(rawKey, 'utf8');
    if (utf8Key.length === 32) {
      return utf8Key;
    }

    const hexKey = /^[a-fA-F0-9]{64}$/.test(rawKey)
      ? Buffer.from(rawKey, 'hex')
      : null;
    if (hexKey && hexKey.length === 32) {
      return hexKey;
    }

    const base64Key = /^[A-Za-z0-9+/]+={0,2}$/.test(rawKey)
      ? Buffer.from(rawKey, 'base64')
      : null;
    if (base64Key && base64Key.length === 32) {
      return base64Key;
    }

    throw new Error(
      'ENCRYPTION_KEY must resolve to exactly 32 bytes (raw utf8, base64, or hex)',
    );
  }
}
