import { WebhookProcessor } from './webhook.processor';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { DELIVER_WEBHOOK_JOB, WEBHOOKS_QUEUE } from './webhook.service';

describe('WebhookProcessor', () => {
  const deliveryRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const subRepo = {
    findOne: jest.fn(),
  };
  const queue = {
    add: jest.fn(),
  };
  const webhooks = {
    decryptRawSecret: jest.fn().mockReturnValue('raw-secret'),
    getDeliveryTimeoutMs: jest.fn().mockReturnValue(10_000),
    deactivateAfterFailures: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
  });

  it('non-2xx triggers retry with specified delay schedule', async () => {
    const delivery: WebhookDelivery = {
      id: 'd1',
      subscriptionId: 's1',
      event: 'transfer.received' as any,
      payload: { x: 1 },
      responseStatus: null,
      responseBody: null,
      attemptCount: 0,
      deliveredAt: null,
      nextRetryAt: new Date(0),
    } as any;
    const sub: WebhookSubscription = {
      id: 's1',
      isActive: true,
      url: 'https://example.com/hook',
      secretEnc: 'enc',
    } as any;

    deliveryRepo.findOne.mockResolvedValueOnce(delivery);
    subRepo.findOne.mockResolvedValueOnce(sub);

    (global as any).fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'nope',
    });

    const processor = new WebhookProcessor(
      deliveryRepo as any,
      subRepo as any,
      queue as any,
      webhooks as any,
    );

    await processor.deliver({ data: { deliveryId: 'd1' } } as any);

    expect(deliveryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ attemptCount: 1 }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      DELIVER_WEBHOOK_JOB,
      { deliveryId: 'd1' },
      expect.objectContaining({ delay: 60_000 }),
    );
  });

  it('after 5 failures, subscription is deactivated and no further retry is scheduled', async () => {
    const delivery: WebhookDelivery = {
      id: 'd2',
      subscriptionId: 's2',
      event: 'transfer.received' as any,
      payload: { x: 1 },
      responseStatus: null,
      responseBody: null,
      attemptCount: 4,
      deliveredAt: null,
      nextRetryAt: new Date(0),
    } as any;
    const sub: WebhookSubscription = {
      id: 's2',
      isActive: true,
      url: 'https://example.com/hook',
      secretEnc: 'enc',
    } as any;

    deliveryRepo.findOne.mockResolvedValueOnce(delivery);
    subRepo.findOne.mockResolvedValueOnce(sub);

    (global as any).fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'nope',
    });

    const processor = new WebhookProcessor(
      deliveryRepo as any,
      subRepo as any,
      queue as any,
      webhooks as any,
    );

    await processor.deliver({ data: { deliveryId: 'd2' } } as any);

    expect(webhooks.deactivateAfterFailures).toHaveBeenCalledWith('s2');
    expect(queue.add).not.toHaveBeenCalled();
  });
});
