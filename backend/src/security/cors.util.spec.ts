import { isAllowedCorsOrigin } from './cors.util';

describe('isAllowedCorsOrigin', () => {
  const frontendUrl = 'http://localhost:3001';

  it('allows the custom Cheesewallet scheme', () => {
    expect(isAllowedCorsOrigin('cheesewallet://', frontendUrl)).toBe(true);
  });

  it('allows secure HTTPS origins', () => {
    expect(isAllowedCorsOrigin('https://app.cheesepay.com', frontendUrl)).toBe(true);
  });

  it('allows the configured frontend origin', () => {
    expect(isAllowedCorsOrigin(frontendUrl, frontendUrl)).toBe(true);
  });

  it('rejects unrelated non-HTTPS origins', () => {
    expect(isAllowedCorsOrigin('http://evil.example.com', frontendUrl)).toBe(false);
  });
});
