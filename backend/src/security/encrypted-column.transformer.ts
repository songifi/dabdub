import { ValueTransformer } from 'typeorm';
import { EncryptionService } from './encryption.service';

export function encryptedColumnTransformer(
  fieldName: string,
): ValueTransformer {
  return {
    to(value: string | null): string | null {
      if (value == null || value === '') return value;
      if (value.startsWith('encv1:')) {
        return value;
      }

      return EncryptionService.getSingleton().encrypt(value);
    },
    from(value: string | null): string | null {
      if (value == null || value === '') return value;
      try {
        return EncryptionService.getSingleton().decrypt(value);
      } catch (error) {
        EncryptionService.getSingleton().logDecryptionFailure(fieldName, error);
        return null;
      }
    },
  };
}
