import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SorobanService, ContractPausedError } from './soroban.service';

describe('SorobanService — global pause switch', () => {
  let service: SorobanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(SorobanService);
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts unpaused', () => {
    expect(service.isPaused()).toBe(false);
  });

  // ── pause() ───────────────────────────────────────────────────────────────

  it('pause() sets paused to true', () => {
    service.pause('admin-1');
    expect(service.isPaused()).toBe(true);
  });

  it('pause() emits a ContractPaused event', () => {
    service.pause('admin-1');
    const events = service.getEventLog();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ContractPaused');
    expect(events[0].admin).toBe('admin-1');
    expect(events[0].timestamp).toBeInstanceOf(Date);
  });

  it('calling pause() twice is idempotent — only one event emitted', () => {
    service.pause('admin-1');
    service.pause('admin-1');
    expect(service.isPaused()).toBe(true);
    expect(service.getEventLog()).toHaveLength(1);
  });

  // ── unpause() ─────────────────────────────────────────────────────────────

  it('unpause() sets paused to false', () => {
    service.pause('admin-1');
    service.unpause('admin-1');
    expect(service.isPaused()).toBe(false);
  });

  it('unpause() emits a ContractUnpaused event', () => {
    service.pause('admin-1');
    service.unpause('admin-1');
    const events = service.getEventLog();
    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('ContractUnpaused');
    expect(events[1].admin).toBe('admin-1');
  });

  it('calling unpause() when already unpaused is idempotent', () => {
    service.unpause('admin-1');
    expect(service.isPaused()).toBe(false);
    expect(service.getEventLog()).toHaveLength(0);
  });

  // ── Mutable operations blocked while paused ───────────────────────────────

  it('deposit() throws ContractPausedError while paused', async () => {
    service.pause('admin-1');
    await expect(service.deposit('GABC', '100')).rejects.toThrow(ContractPausedError);
  });

  it('release() throws ContractPausedError while paused', async () => {
    service.pause('admin-1');
    await expect(service.release('pay-1', 'GMERCHANT')).rejects.toThrow(ContractPausedError);
  });

  it('refund() throws ContractPausedError while paused', async () => {
    service.pause('admin-1');
    await expect(service.refund('pay-1', 'GCUSTOMER')).rejects.toThrow(ContractPausedError);
  });

  // ── View functions remain accessible while paused ─────────────────────────

  it('getBalance() works while paused', async () => {
    service.pause('admin-1');
    await expect(service.getBalance('GABC')).resolves.toBe('0');
  });

  it('getStakeBalance() works while paused', async () => {
    service.pause('admin-1');
    await expect(service.getStakeBalance('GABC')).resolves.toBe('0');
  });

  it('isPaused() works while paused', () => {
    service.pause('admin-1');
    expect(service.isPaused()).toBe(true);
  });

  it('getEventLog() works while paused', () => {
    service.pause('admin-1');
    expect(service.getEventLog()).toHaveLength(1);
  });

  // ── Operations resume after unpause ──────────────────────────────────────

  it('deposit() succeeds after unpause', async () => {
    service.pause('admin-1');
    service.unpause('admin-1');
    await expect(service.deposit('GABC', '100')).resolves.toBeUndefined();
  });

  it('release() succeeds after unpause', async () => {
    service.pause('admin-1');
    service.unpause('admin-1');
    await expect(service.release('pay-1', 'GMERCHANT')).resolves.toBeUndefined();
  });

  it('refund() succeeds after unpause', async () => {
    service.pause('admin-1');
    service.unpause('admin-1');
    await expect(service.refund('pay-1', 'GCUSTOMER')).resolves.toBeUndefined();
  });

  // ── Full incident scenario ────────────────────────────────────────────────

  it('full incident: normal ops → pause → all writes blocked → reads ok → unpause → normal ops', async () => {
    // Normal operations before incident
    await service.deposit('GABC', '50');
    await service.release('pay-1', 'GMERCHANT');

    // Security incident — admin halts everything
    service.pause('security-admin');
    expect(service.isPaused()).toBe(true);

    // All writes blocked
    await expect(service.deposit('GATTACKER', '9999')).rejects.toThrow(ContractPausedError);
    await expect(service.release('pay-exploit', 'GATTACKER')).rejects.toThrow(ContractPausedError);
    await expect(service.refund('pay-exploit', 'GATTACKER')).rejects.toThrow(ContractPausedError);

    // Monitoring reads still work
    await expect(service.getBalance('GABC')).resolves.toBe('0');
    await expect(service.getStakeBalance('GABC')).resolves.toBe('0');

    // Incident resolved — admin resumes
    service.unpause('security-admin');
    expect(service.isPaused()).toBe(false);

    // Normal operations resume
    await expect(service.deposit('GABC', '50')).resolves.toBeUndefined();
    await expect(service.release('pay-2', 'GMERCHANT')).resolves.toBeUndefined();

    // Event log tells the full story
    const events = service.getEventLog();
    expect(events.map((e) => e.type)).toEqual(['ContractPaused', 'ContractUnpaused']);
  });
});
