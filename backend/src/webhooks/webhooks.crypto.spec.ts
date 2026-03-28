import { hmacSha256Hex } from './webhooks.crypto';
import * as crypto from 'crypto';

describe('webhooks.crypto', () => {
  it('computes correct HMAC-SHA256 hex over JSON.stringify(payload)', () => {
    const secret = 'supersecret';
    const payload = { a: 1, b: 'two' };
    const json = JSON.stringify(payload);

    const expected = crypto
      .createHmac('sha256', secret)
      .update(json)
      .digest('hex');
    const actual = hmacSha256Hex(json, secret);

    expect(actual).toBe(expected);
  });
});
