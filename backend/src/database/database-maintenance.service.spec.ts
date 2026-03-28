import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DatabaseMaintenanceService } from './database-maintenance.service';

describe('DatabaseMaintenanceService', () => {
  let service: DatabaseMaintenanceService;
  let dataSourceMock: jest.Mocked<DataSource>;

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseMaintenanceService,
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<DatabaseMaintenanceService>(DatabaseMaintenanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanupExpiredOtps', () => {
    it('should delete expired OTPs older than 7 days', async () => {
      const mockResult = [{ id: '1' }, { id: '2' }];
      (dataSourceMock.query as jest.Mock).mockResolvedValue(mockResult);

      await service.cleanupExpiredOtps();

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        `DELETE FROM "otps" WHERE "expires_at" < NOW() - INTERVAL '7 days'`,
      );
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      (dataSourceMock.query as jest.Mock).mockRejectedValue(error);

      // Should not throw
      await expect(service.cleanupExpiredOtps()).resolves.toBeUndefined();
      expect(dataSourceMock.query).toHaveBeenCalled();
    });
  });

  describe('cleanupRevokedRefreshTokens', () => {
    it('should delete revoked refresh tokens older than 30 days', async () => {
      const mockResult = [{ id: 'token-1' }, { id: 'token-2' }];
      (dataSourceMock.query as jest.Mock).mockResolvedValue(mockResult);

      await service.cleanupRevokedRefreshTokens();

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        `DELETE FROM "refresh_tokens" WHERE "revoked_at" IS NOT NULL AND "revoked_at" < NOW() - INTERVAL '30 days'`,
      );
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      (dataSourceMock.query as jest.Mock).mockRejectedValue(error);

      // Should not throw
      await expect(service.cleanupRevokedRefreshTokens()).resolves.toBeUndefined();
      expect(dataSourceMock.query).toHaveBeenCalled();
    });
  });

  describe('cleanupOldWebhookLogs', () => {
    it('should delete webhook delivery logs older than 90 days', async () => {
      const mockResult = [{ id: 'log-1' }];
      (dataSourceMock.query as jest.Mock).mockResolvedValue(mockResult);

      await service.cleanupOldWebhookLogs();

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        `DELETE FROM "webhook_deliveries" WHERE "created_at" < NOW() - INTERVAL '90 days'`,
      );
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      (dataSourceMock.query as jest.Mock).mockRejectedValue(error);

      // Should not throw
      await expect(service.cleanupOldWebhookLogs()).resolves.toBeUndefined();
      expect(dataSourceMock.query).toHaveBeenCalled();
    });
  });

  describe('runAllCleanupJobs', () => {
    it('should run all cleanup jobs in sequence', async () => {
      (dataSourceMock.query as jest.Mock).mockResolvedValue([]);

      await service.runAllCleanupJobs();

      expect(dataSourceMock.query).toHaveBeenCalledTimes(3);
      expect(dataSourceMock.query).toHaveBeenNthCalledWith(
        1,
        `DELETE FROM "otps" WHERE "expires_at" < NOW() - INTERVAL '7 days'`,
      );
      expect(dataSourceMock.query).toHaveBeenNthCalledWith(
        2,
        `DELETE FROM "refresh_tokens" WHERE "revoked_at" IS NOT NULL AND "revoked_at" < NOW() - INTERVAL '30 days'`,
      );
      expect(dataSourceMock.query).toHaveBeenNthCalledWith(
        3,
        `DELETE FROM "webhook_deliveries" WHERE "created_at" < NOW() - INTERVAL '90 days'`,
      );
    });

    it('should continue even if one job fails', async () => {
      // First query fails, others succeed
      (dataSourceMock.query as jest.Mock)
        .mockRejectedValueOnce(new Error('OTP cleanup failed'))
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Should not throw
      await expect(service.runAllCleanupJobs()).resolves.toBeUndefined();

      // All three jobs should still be attempted
      expect(dataSourceMock.query).toHaveBeenCalledTimes(3);
    });
  });
});
