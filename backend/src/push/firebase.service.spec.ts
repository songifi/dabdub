import { FirebaseService } from './firebase.service';
import { DevicePlatform } from './entities/device-token.entity';

const sendEachForMulticast = jest.fn();
const sendNotification = jest.fn();
const setVapidDetails = jest.fn();

jest.mock('firebase-admin', () => ({
  apps: [{}],
  credential: { cert: jest.fn() },
  initializeApp: jest.fn(),
  messaging: () => ({
    sendEachForMulticast,
  }),
}));

jest.mock('web-push', () => ({
  sendNotification,
  setVapidDetails,
}), { virtual: true });

describe('FirebaseService', () => {
  let service: FirebaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FirebaseService(
      { serviceAccount: '{}' } as any,
      {
        publicKey: 'public-key',
        privateKey: 'private-key',
        subject: 'mailto:test@example.com',
      } as any,
    );
    (service as any).messaging = {
      sendEachForMulticast,
    };
  });

  it('routes web subscriptions through web-push instead of FCM', async () => {
    sendNotification.mockResolvedValue(undefined);

    const result = await service.sendToDevices(
      [
        {
          token: 'https://push.example.com/subscriptions/1',
          platform: DevicePlatform.WEB,
          subscription: {
            endpoint: 'https://push.example.com/subscriptions/1',
            keys: {
              auth: 'auth',
              p256dh: 'p256dh',
            },
          },
        },
      ] as any,
      {
        title: 'Balance updated',
        body: 'Your offline balance has been refreshed.',
      },
    );

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(result.failedTokens).toEqual([]);
    expect(result.successCount).toBe(1);
  });
});
