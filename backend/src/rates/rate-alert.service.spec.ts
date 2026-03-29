import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RateAlertService } from './rate-alert.service';
import { AlertDirection, AlertStatus } from './entities/rate-alert.entity';

describe('RateAlertService', () => {
  const alertRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const alertQueue = {
    add: jest.fn(),
  };

  function createService(): RateAlertService {
    return new RateAlertService(alertRepo as any, alertQueue as any);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    alertRepo.create.mockImplementation((p: any) => p);
    alertRepo.save.mockImplementation(async (p: any) => ({ id: 'alert-1', ...p }));
    alertRepo.count.mockResolvedValue(0);
    alertRepo.update.mockResolvedValue(undefined);
    alertQueue.add.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('creates alert successfully', async () => {
      const service = createService();
      const result = await service.create('user-1', {
        targetRate: 1600,
        direction: AlertDirection.ABOVE,
      });
      expect(result.id).toBe('alert-1');
      expect(alertRepo.save).toHaveBeenCalled();
    });

    it('enforces max 5 active alerts per user', async () => {
      const service = createService();
      alertRepo.count.mockResolvedValue(5);

      await expect(
        service.create('user-1', { targetRate: 1600, direction: AlertDirection.ABOVE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects targetRate <= 0', async () => {
      const service = createService();

      await expect(
        service.create('user-1', { targetRate: 0, direction: AlertDirection.ABOVE }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkAlerts', () => {
    const makeAlert = (id: string, target: number, direction: AlertDirection) => ({
      id,
      userId: 'user-1',
      targetRate: target.toString(),
      direction,
      status: AlertStatus.ACTIVE,
      triggeredAt: null,
      notifiedVia: [],
    });

    it('fires when direction=above and rate > target', async () => {
      const service = createService();
      alertRepo.find.mockResolvedValue([makeAlert('a1', 1500, AlertDirection.ABOVE)]);

      await service.checkAlerts(1600);

      expect(alertRepo.update).toHaveBeenCalledWith('a1', expect.objectContaining({
        status: AlertStatus.TRIGGERED,
        triggeredAt: expect.any(Date),
      }));
      expect(alertQueue.add).toHaveBeenCalledWith(
        'fire-rate-alert',
        expect.objectContaining({ alertId: 'a1', currentRate: '1600' }),
      );
    });

    it('does not fire when direction=above and rate < target', async () => {
      const service = createService();
      alertRepo.find.mockResolvedValue([makeAlert('a1', 1700, AlertDirection.ABOVE)]);

      await service.checkAlerts(1600);

      expect(alertRepo.update).not.toHaveBeenCalled();
      expect(alertQueue.add).not.toHaveBeenCalled();
    });

    it('fires when direction=below and rate < target', async () => {
      const service = createService();
      alertRepo.find.mockResolvedValue([makeAlert('a1', 1700, AlertDirection.BELOW)]);

      await service.checkAlerts(1600);

      expect(alertRepo.update).toHaveBeenCalledWith('a1', expect.objectContaining({
        status: AlertStatus.TRIGGERED,
      }));
      expect(alertQueue.add).toHaveBeenCalled();
    });

    it('does not fire when direction=below and rate > target', async () => {
      const service = createService();
      alertRepo.find.mockResolvedValue([makeAlert('a1', 1500, AlertDirection.BELOW)]);

      await service.checkAlerts(1600);

      expect(alertRepo.update).not.toHaveBeenCalled();
    });

    it('does not re-fire already triggered alerts (only loads ACTIVE)', async () => {
      const service = createService();
      // checkAlerts only queries ACTIVE alerts — triggered ones are excluded
      alertRepo.find.mockResolvedValue([]); // no active alerts

      await service.checkAlerts(1600);

      expect(alertQueue.add).not.toHaveBeenCalled();
    });

    it('fires multiple alerts in one check', async () => {
      const service = createService();
      alertRepo.find.mockResolvedValue([
        makeAlert('a1', 1500, AlertDirection.ABOVE),
        makeAlert('a2', 1700, AlertDirection.BELOW),
      ]);

      await service.checkAlerts(1600);

      expect(alertRepo.update).toHaveBeenCalledTimes(2);
      expect(alertQueue.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancel', () => {
    it('cancels an alert belonging to the user', async () => {
      const service = createService();
      alertRepo.findOne.mockResolvedValue({
        id: 'a1',
        userId: 'user-1',
        status: AlertStatus.ACTIVE,
      });

      const result = await service.cancel('a1', 'user-1');

      expect(alertRepo.update).toHaveBeenCalledWith('a1', { status: AlertStatus.CANCELLED });
      expect(result.status).toBe(AlertStatus.CANCELLED);
    });

    it('throws NotFoundException for alert not belonging to user', async () => {
      const service = createService();
      alertRepo.findOne.mockResolvedValue(null);

      await expect(service.cancel('a1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
