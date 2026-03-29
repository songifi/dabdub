import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';

jest.mock('../push/push.service', () => ({
  PushService: class MockPushService {},
}));

import { MaintenanceProcessor } from './maintenance.processor';
import { MaintenanceService } from './maintenance.service';
import { CheeseGateway, WS_EVENTS } from '../ws/cheese.gateway';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';
import { UsersService } from '../users/users.service';
import { MaintenanceStatus } from './entities/maintenance-window.entity';

jest.mock('@sentry/nestjs', () => ({
  startSpan: (_ctx: unknown, fn: () => Promise<void>) => fn(),
  captureException: jest.fn(),
}));

describe('MaintenanceProcessor', () => {
  let processor: MaintenanceProcessor;
  let maintenanceService: jest.Mocked<MaintenanceService>;
  let wsGateway: { emitToAll: jest.Mock };
  let pushService: { sendBulk: jest.Mock };
  let emailService: { queue: jest.Mock };
  let usersService: { findActiveUsers: jest.Mock };

  const cancelledWindow = {
    id: 'w1',
    title: 'Planned work',
    description: 'Desc',
    startAt: new Date('2030-01-01T00:00:00Z'),
    endAt: new Date('2030-01-01T04:00:00Z'),
    affectedServices: ['transfers'],
    status: MaintenanceStatus.CANCELLED,
    createdBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    wsGateway = { emitToAll: jest.fn() };
    pushService = { sendBulk: jest.fn().mockResolvedValue(undefined) };
    emailService = { queue: jest.fn().mockResolvedValue(undefined) };
    usersService = {
      findActiveUsers: jest.fn().mockResolvedValue([
        {
          id: 'u1',
          email: 'a@b.c',
          username: 'alice',
          displayName: 'Alice',
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceProcessor,
        {
          provide: MaintenanceService,
          useValue: {
            findById: jest.fn(),
            setActive: jest.fn(),
            setCompleted: jest.fn(),
          },
        },
        { provide: CheeseGateway, useValue: wsGateway },
        { provide: EmailService, useValue: emailService },
        { provide: PushService, useValue: pushService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    processor = module.get(MaintenanceProcessor);
    maintenanceService = module.get(MaintenanceService);
  });

  it('cancel_notify sends push, email, and websocket', async () => {
    maintenanceService.findById.mockResolvedValue(cancelledWindow as never);

    const job = {
      data: { windowId: 'w1', action: 'cancel_notify' as const },
    } as Job;

    await processor.handleMaintenanceJob(job);

    expect(pushService.sendBulk).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({
        title: 'Scheduled maintenance cancelled',
        data: expect.objectContaining({ type: 'maintenance_cancelled' }),
      }),
    );
    expect(emailService.queue).toHaveBeenCalledWith(
      'a@b.c',
      'maintenance-cancelled',
      expect.objectContaining({ firstName: 'Alice', title: 'Planned work' }),
    );
    expect(wsGateway.emitToAll).toHaveBeenCalledWith(
      WS_EVENTS.SYSTEM_MAINTENANCE_CANCELLED,
      { id: 'w1', title: 'Planned work' },
    );
  });

  it('start job is a no-op when window is not scheduled', async () => {
    maintenanceService.findById.mockResolvedValue({
      ...cancelledWindow,
      status: MaintenanceStatus.CANCELLED,
    } as never);

    await processor.handleMaintenanceJob({
      data: { windowId: 'w1', action: 'start' },
    } as Job);

    expect(maintenanceService.setActive).not.toHaveBeenCalled();
    expect(wsGateway.emitToAll).not.toHaveBeenCalled();
  });

  it('notify job skips when window was cancelled', async () => {
    maintenanceService.findById.mockResolvedValue({
      ...cancelledWindow,
      status: MaintenanceStatus.CANCELLED,
    } as never);

    await processor.handleMaintenanceJob({
      data: { windowId: 'w1', action: 'notify_1h' },
    } as Job);

    expect(usersService.findActiveUsers).not.toHaveBeenCalled();
    expect(pushService.sendBulk).not.toHaveBeenCalled();
  });
});
