import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppThrottlerGuard } from "./throttler.guard";

function makeContext(
  path: string,
  user?: { merchantId: string },
): ExecutionContext {
  const req = { path, ip: "127.0.0.1", user };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("AppThrottlerGuard", () => {
  let guard: AppThrottlerGuard;

  beforeEach(() => {
    guard = new AppThrottlerGuard(
      { throttlers: [{ name: "default", ttl: 60000, limit: 100 }] },
      {
        increment: jest.fn().mockResolvedValue({
          totalHits: 1,
          timeToExpire: 60,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      } as any,
      new Reflector(),
    );
  });

  it("should skip /health endpoint", async () => {
    const ctx = makeContext("/api/v1/health");
    const result = await (guard as any).shouldSkip(ctx);
    expect(result).toBe(true);
  });

  it("should not skip non-health endpoints", async () => {
    const ctx = makeContext("/api/v1/payments");
    const result = await (guard as any).shouldSkip(ctx);
    expect(result).toBe(false);
  });

  it("should use IP as tracker for unauthenticated requests", async () => {
    const req = { ip: "10.0.0.1" };
    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe("10.0.0.1");
  });

  it("should use merchantId as tracker for authenticated requests", async () => {
    const req = { ip: "10.0.0.1", user: { merchantId: "merchant-123" } };
    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe("merchant:merchant-123");
  });

  it('should skip "authenticated" throttler for unauthenticated requests', async () => {
    const ctx = makeContext("/api/v1/payments");
    const result = await (guard as any).handleRequest({
      context: ctx,
      throttler: { name: "authenticated" },
    });
    expect(result).toBe(true);
  });

  it('should skip "default" throttler for authenticated requests', async () => {
    const ctx = makeContext("/api/v1/payments", { merchantId: "merchant-abc" });
    const result = await (guard as any).handleRequest({
      context: ctx,
      throttler: { name: "default" },
    });
    expect(result).toBe(true);
  });
});
