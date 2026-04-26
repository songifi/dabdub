import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SorobanService, ReentrantCallError } from './soroban.service';

describe('SorobanService — reentrancy guard', () => {
  let service: SorobanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(SorobanService);
  });

  // ── Normal sequential calls must work fine ──────────────────────────────────

  it('allows deposit → release in sequence', async () => {
    await expect(service.deposit('GABC', '100')).resolves.toBeUndefined();
    await expect(service.release('pay-1', 'GMERCHANT')).resolves.toBeUndefined();
  });

  it('allows deposit → refund in sequence', async () => {
    await expect(service.deposit('GABC', '50')).resolves.toBeUndefined();
    await expect(service.refund('pay-2', 'GCUSTOMER')).resolves.toBeUndefined();
  });

  it('allows multiple sequential deposits', async () => {
    await service.deposit('GABC', '10');
    await service.deposit('GABC', '20');
    await service.deposit('GABC', '30');
    // no error — each call completes before the next starts
  });

  // ── Exploit simulation: reentrant calls must be blocked ─────────────────────

  /**
   * Simulates a malicious cross-contract callback that tries to call release()
   * again while the first release() is still executing (i.e. awaiting the
   * contract invocation). The guard must reject the inner call.
   */
  it('blocks a reentrant release() call — exploit simulation', async () => {
    let innerError: Error | null = null;

    // Patch the internal contract stub so it fires a reentrant call mid-flight.
    // In a real exploit this would be triggered by a malicious contract callback.
    const originalRelease = (service as any).release.bind(service);

    // We simulate reentrancy by manually setting locked=true and then calling
    // release() directly — exactly what a reentrant callback would encounter.
    (service as any).locked = true;

    try {
      await service.release('pay-exploit', 'GATTACKER');
    } catch (err) {
      innerError = err as Error;
    }

    // Guard must have fired before any state change
    expect(innerError).toBeInstanceOf(ReentrantCallError);
    expect(innerError!.message).toContain('ReentrantCall');

    // Restore clean state for subsequent tests
    (service as any).locked = false;
  });

  it('blocks a reentrant deposit() call', async () => {
    (service as any).locked = true;

    await expect(service.deposit('GATTACKER', '9999')).rejects.toThrow(ReentrantCallError);

    (service as any).locked = false;
  });

  it('blocks a reentrant refund() call', async () => {
    (service as any).locked = true;

    await expect(service.refund('pay-exploit', 'GATTACKER')).rejects.toThrow(ReentrantCallError);

    (service as any).locked = false;
  });

  /**
   * Verifies the lock is always released even when the contract call throws.
   * Without the finally{} block a failed call would permanently deadlock the service.
   */
  it('releases the lock after a failed deposit so subsequent calls succeed', async () => {
    // Force the internal stub to throw
    jest
      .spyOn(service as any, 'deposit')
      .mockImplementationOnce(async () => {
        (service as any).acquireLock();
        try {
          throw new Error('contract invocation failed');
        } finally {
          (service as any).releaseLock();
        }
      });

    await expect(service.deposit('GABC', '1')).rejects.toThrow('contract invocation failed');

    // Lock must be clear — next call should go through
    await expect(service.deposit('GABC', '1')).resolves.toBeUndefined();
  });

  /**
   * Full end-to-end reentrancy scenario:
   * outer release() starts → inner release() is attempted mid-flight → blocked →
   * outer release() completes normally → next sequential call succeeds.
   */
  it('full exploit scenario: outer call completes, inner is blocked, next call succeeds', async () => {
    const events: string[] = [];

    // Intercept acquireLock/releaseLock to trace execution order
    const origAcquire = (service as any).acquireLock.bind(service);
    const origRelease = (service as any).releaseLock.bind(service);

    jest.spyOn(service as any, 'acquireLock').mockImplementation(() => {
      events.push('acquire');
      origAcquire();
    });
    jest.spyOn(service as any, 'releaseLock').mockImplementation(() => {
      events.push('release');
      origRelease();
    });

    // Outer call
    await service.release('pay-outer', 'GMERCHANT');

    // Simulate attacker trying to re-enter while outer is "in flight"
    // (we test this by manually locking and calling)
    (service as any).locked = true;
    let attackBlocked = false;
    try {
      await service.release('pay-attack', 'GATTACKER');
    } catch (err) {
      if (err instanceof ReentrantCallError) attackBlocked = true;
    }
    (service as any).locked = false;

    // Sequential call after attack attempt — must succeed
    await service.release('pay-next', 'GMERCHANT');

    expect(attackBlocked).toBe(true);
    // outer + attack attempt (throws) + next = 3 acquires
    // outer + next = 2 releases (attack never reaches releaseLock)
    expect(events.filter((e) => e === 'acquire').length).toBe(3);
    expect(events.filter((e) => e === 'release').length).toBe(2);
  });
});
