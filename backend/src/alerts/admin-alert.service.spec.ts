import { AdminAlertService } from './admin-alert.service';
import { AdminAlertStatus, AdminAlertType } from './admin-alert.entity';

describe('AdminAlertService', () => {
  const save = jest.fn((entity: unknown) => entity);
  const findOne = jest.fn();
  const repo = {
    create: jest.fn((entity: unknown) => entity),
    save,
    findOne,
    find: jest.fn(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('suppresses duplicate notifications during cooldown', async () => {
    findOne.mockResolvedValue({
      id: 'alert-1',
      type: AdminAlertType.STELLAR_MONITOR,
      dedupeKey: 'stellar-monitor',
      status: AdminAlertStatus.OPEN,
      message: 'old',
      occurrenceCount: 1,
      thresholdValue: 1,
      metadata: null,
      lastNotifiedAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
    });

    const service = new AdminAlertService(
      repo as never,
      {
        get: jest.fn((key: string) => {
          if (key === 'ADMIN_ALERT_COOLDOWN_MINUTES') return '30';
          if (key === 'ADMIN_ALERT_STELLAR_FAILURE_THRESHOLD') return '1';
          return undefined;
        }),
      } as never,
    );

    const result = await service.raise({
      type: AdminAlertType.STELLAR_MONITOR,
      dedupeKey: 'stellar-monitor',
      message: 'Stellar monitor failed',
      thresholdValue: 1,
    });

    expect(result?.occurrenceCount).toBe(2);
  });
});
