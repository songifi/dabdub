import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<Pick<NotificationService, 'getUnreadCount' | 'listForUser' | 'markRead' | 'markAllRead'>>;

  beforeEach(async () => {
    service = {
      getUnreadCount: jest.fn(),
      listForUser: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationService, useValue: service }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('list returns items and sets unread count header', async () => {
    const req = { user: { id: 'u1' } } as any;
    const res = { setHeader: jest.fn() } as any;

    service.getUnreadCount.mockResolvedValueOnce(7);
    service.listForUser.mockResolvedValueOnce({ items: [{ id: 'n1' }], nextCursor: null });

    const result = await controller.list(req, { limit: 10, cursor: undefined } as any, res);

    expect(service.getUnreadCount).toHaveBeenCalledWith('u1');
    expect(res.setHeader).toHaveBeenCalledWith('X-Unread-Count', '7');
    expect(result).toEqual({ items: [{ id: 'n1' }], nextCursor: null });
  });

  it('unreadCount returns unread count', async () => {
    const req = { user: { id: 'u1' } } as any;
    service.getUnreadCount.mockResolvedValueOnce(4);

    const result = await controller.unreadCount(req);

    expect(result).toEqual({ count: 4 });
    expect(service.getUnreadCount).toHaveBeenCalledWith('u1');
  });

  it('markRead calls service with current user and notification id', async () => {
    const req = { user: { id: 'u1' } } as any;
    await controller.markRead(req, 'n1');

    expect(service.markRead).toHaveBeenCalledWith('u1', 'n1');
  });

  it('markAllRead calls service with current user', async () => {
    const req = { user: { id: 'u1' } } as any;
    await controller.markAllRead(req);

    expect(service.markAllRead).toHaveBeenCalledWith('u1');
  });
});
