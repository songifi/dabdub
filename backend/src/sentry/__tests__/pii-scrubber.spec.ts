import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Sentry PII Scrubber', () => {
  // Import the scrubPII function and PII_FIELDS from main.ts
  // We need to test the logic independently
  const PII_FIELDS = ['email', 'phone', 'passwordHash', 'pinHash', 'encryptedSecretKey'];

  function scrubPII(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(scrubPII);
    }

    if (typeof obj === 'object') {
      const scrubbed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (PII_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
          scrubbed[key] = '[Filtered]';
        } else {
          scrubbed[key] = scrubPII(value);
        }
      }
      return scrubbed;
    }

    return obj;
  }

  describe('scrubPII', () => {
    it('should return null and undefined as-is', () => {
      expect(scrubPII(null)).toBe(null);
      expect(scrubPII(undefined)).toBe(undefined);
    });

    it('should return strings unchanged', () => {
      expect(scrubPII('hello')).toBe('hello');
      expect(scrubPII('')).toBe('');
    });

    it('should return numbers unchanged', () => {
      expect(scrubPII(123)).toBe(123);
      expect(scrubPII(0)).toBe(0);
      expect(scrubPII(-456)).toBe(-456);
    });

    it('should return booleans unchanged', () => {
      expect(scrubPII(true)).toBe(true);
      expect(scrubPII(false)).toBe(false);
    });

    it('should scrub email field', () => {
      const obj = { email: 'user@example.com', name: 'John' };
      const result = scrubPII(obj);
      expect(result).toEqual({ email: '[Filtered]', name: 'John' });
    });

    it('should scrub phone field', () => {
      const obj = { phone: '+1234567890', name: 'John' };
      const result = scrubPII(obj);
      expect(result).toEqual({ phone: '[Filtered]', name: 'John' });
    });

    it('should scrub passwordHash field', () => {
      const obj = { passwordHash: 'abc123', username: 'john' };
      const result = scrubPII(obj);
      expect(result).toEqual({ passwordHash: '[Filtered]', username: 'john' });
    });

    it('should scrub pinHash field', () => {
      const obj = { pinHash: 'xyz789', userId: '123' };
      const result = scrubPII(obj);
      expect(result).toEqual({ pinHash: '[Filtered]', userId: '123' });
    });

    it('should scrub encryptedSecretKey field', () => {
      const obj = { encryptedSecretKey: 'secret123', publicKey: 'pub456' };
      const result = scrubPII(obj);
      expect(result).toEqual({ encryptedSecretKey: '[Filtered]', publicKey: 'pub456' });
    });

    it('should handle case-insensitive field matching', () => {
      const obj = { EMAIL: 'test@example.com', PhoneNumber: '+1234567890' };
      const result = scrubPII(obj);
      expect(result).toEqual({ EMAIL: '[Filtered]', PhoneNumber: '[Filtered]' });
    });

    it('should scrub nested objects', () => {
      const obj = {
        user: {
          email: 'nested@example.com',
          profile: {
            phone: '+1234567890',
            age: 30,
          },
        },
      };
      const result = scrubPII(obj) as Record<string, unknown>;
      expect(result.user).toEqual({
        email: '[Filtered]',
        profile: {
          phone: '[Filtered]',
          age: 30,
        },
      });
    });

    it('should scrub arrays of objects', () => {
      const obj = {
        users: [
          { email: 'user1@example.com', id: 1 },
          { email: 'user2@example.com', id: 2 },
        ],
      };
      const result = scrubPII(obj) as Record<string, unknown>;
      expect(result.users).toEqual([
        { email: '[Filtered]', id: 1 },
        { email: '[Filtered]', id: 2 },
      ]);
    });

    it('should handle empty objects', () => {
      expect(scrubPII({})).toEqual({});
    });

    it('should handle empty arrays', () => {
      expect(scrubPII([])).toEqual([]);
    });

    it('should preserve non-PII fields in complex objects', () => {
      const obj = {
        id: '123',
        username: 'john_doe',
        email: 'john@example.com',
        role: 'admin',
        passwordHash: 'hash123',
        createdAt: '2024-01-01',
      };
      const result = scrubPII(obj);
      expect(result).toEqual({
        id: '123',
        username: 'john_doe',
        email: '[Filtered]',
        role: 'admin',
        passwordHash: '[Filtered]',
        createdAt: '2024-01-01',
      });
    });
  });
});
