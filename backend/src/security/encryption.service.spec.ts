import { EncryptionService } from './encryption.service';
import { encryptedColumnTransformer } from './encrypted-column.transformer';

describe('EncryptionService', () => {
  const key = '0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = key;
  });

  it('encrypts and decrypts using AES-256-GCM', () => {
    const service = new EncryptionService();
    const encrypted = service.encrypt('sensitive-value');
    expect(encrypted.startsWith('encv1:')).toBe(true);
    expect(service.decrypt(encrypted)).toBe('sensitive-value');
  });

  it('column transformer encrypts on write and decrypts on read', () => {
    const transformer = encryptedColumnTransformer('test.field');
    const encrypted = transformer.to('1234567890');
    expect(encrypted).toContain('encv1:');
    expect(transformer.from(encrypted as string)).toBe('1234567890');
  });
});
