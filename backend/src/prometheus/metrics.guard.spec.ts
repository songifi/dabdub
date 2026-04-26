import { ExecutionContext } from '@nestjs/common';
import { MetricsGuard } from './metrics.guard';

describe('MetricsGuard', () => {
  let guard: MetricsGuard;

  beforeEach(() => {
    guard = new MetricsGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow requests from 127.0.0.1', () => {
    const context = createMockContext('127.0.0.1');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow requests from ::1', () => {
    const context = createMockContext('::1');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow requests from 10.0.0.5', () => {
    const context = createMockContext('10.0.0.5');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow requests from 172.16.5.1', () => {
    const context = createMockContext('172.16.5.1');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow requests from 192.168.1.100', () => {
    const context = createMockContext('192.168.1.100');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny requests from public IP 8.8.8.8', () => {
    const context = createMockContext('8.8.8.8');
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny requests from public IP 203.0.113.1', () => {
    const context = createMockContext('203.0.113.1');
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny requests with no IP', () => {
    const context = createMockContext('');
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should allow x-forwarded-for internal IP', () => {
    const context = createMockContext('203.0.113.1', '192.168.1.50');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny x-forwarded-for public IP', () => {
    const context = createMockContext('127.0.0.1', '8.8.8.8');
    expect(guard.canActivate(context)).toBe(false);
  });
});

function createMockContext(
  remoteAddress: string,
  forwardedFor?: string,
): ExecutionContext {
  const headers: Record<string, string> = {};
  if (forwardedFor) {
    headers['x-forwarded-for'] = forwardedFor;
  }

  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip: remoteAddress,
        headers,
        connection: { remoteAddress },
      }),
    }),
  } as unknown as ExecutionContext;
}

