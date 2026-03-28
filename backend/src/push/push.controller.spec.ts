import { Test, TestingModule } from '@nestjs/testing';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { webPushConfig } from '../config';
import { DevicePlatform } from './entities/device-token.entity';

describe('PushController', () => {
  let controller: PushController;
  let service: jest.Mocked<PushService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushController],
      providers: [
        {
          provide: PushService,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn(),
            registerWebSubscription: jest.fn(),
            unregisterWebSubscription: jest.fn(),
          },
        },
        {
          provide: webPushConfig.KEY,
          useValue: {
            publicKey: 'public-test-key',
          },
        },
      ],
    }).compile();

    controller = module.get(PushController);
    service = module.get(PushService);
  });

  it('returns the VAPID public key as a string', () => {
    expect(controller.getVapidPublicKey()).toBe('public-test-key');
  });

  it('registers a web subscription for the authenticated user', async () => {
    const subscription = {
      endpoint: 'https://push.example.com/subscriptions/123',
      keys: {
        auth: 'auth',
        p256dh: 'p256dh',
      },
    };

    service.registerWebSubscription.mockResolvedValue({
      id: 'device-1',
      userId: 'user-1',
      token: subscription.endpoint,
      platform: DevicePlatform.WEB,
      subscription,
      isActive: true,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await controller.subscribeWeb(
      { subscription } as any,
      { user: { id: 'user-1' } } as any,
    );

    expect(service.registerWebSubscription).toHaveBeenCalledWith(
      'user-1',
      subscription,
    );
  });
});
