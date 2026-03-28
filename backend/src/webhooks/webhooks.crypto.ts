import * as crypto from 'crypto';

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hmacSha256Hex(payloadJson: string, rawSecret: string): string {
  return crypto
    .createHmac('sha256', rawSecret)
    .update(payloadJson)
    .digest('hex');
}

/**
 * Encrypts plaintext using AES-256-GCM. Output is:
 *   base64(iv) + "." + base64(tag) + "." + base64(ciphertext)
 */
export function encryptAes256Gcm(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptAes256Gcm(enc: string, key: Buffer): string {
  const [ivB64, tagB64, ctB64] = enc.split('.');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Invalid encrypted secret');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function derive32ByteKeyFromString(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}
