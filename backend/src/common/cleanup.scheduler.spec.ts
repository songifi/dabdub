import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { CleanupScheduler } from './cleanup.scheduler';

describe('CleanupScheduler', () => {
  let scheduler: CleanupScheduler;
  let queryBuilder: {
    delete: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    execute: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    const mockDataSource = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupScheduler,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    scheduler = module.get<CleanupScheduler>(CleanupScheduler);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  it('should hard delete participants and splits older than 90 days', async () => {
    await scheduler.hardDeleteExpiredSoftDeletes();

    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.from).toHaveBeenCalledWith('participants');
    expect(queryBuilder.from).toHaveBeenCalledWith('splits');
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'deleted_at IS NOT NULL AND deleted_at < :cutoff',
      expect.objectContaining({ cutoff: expect.any(String) }),
    );
    expect(queryBuilder.execute).toHaveBeenCalledTimes(2);
  });
});
