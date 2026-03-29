import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OffRampWebhookController } from './offramp-webhook.controller';
import { OffRampService } from './offramp.service';

const FAKE_SECRET = 'test-paystack-secret';

function makeSignature(body: string): string {
  return crypto.createHmac('sha512', FAKE_SECRET).update(body).digest('hex');
}

function makeRequest(body: object, secret = FAKE_SECRET) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    rawBody: raw,
    body,
  } as any;
}

describe('OffRampWebhookController', () => {
  let controller: OffRampWebhookController;
  let offRampService: jest.Mocked<OffRampService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OffRampWebhookController],
      providers: [
        {
          provide: OffRampService,
          useValue: {
            handlePaystackTransferSuccess: jest.fn().mockResolvedValue(undefined),
            handlePaystackTransferFailed: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(FAKE_SECRET) },
        },
      ],
    }).compile();

    controller = module.get(OffRampWebhookController);
    offRampService = module.get(OffRampService) as jest.Mocked<OffRampService>;
  });

  // ── signature validation ──────────────────────────────────────────────────

  it('rejects request with invalid signature', async () => {
    const body = { event: 'transfer.success', data: { reference: 'X', transfer_code: 'Y', reason: 'X' } };
    const req = makeRequest(body);

    await expect(
      controller.handlePaystackWebhook(req, 'bad-signature'),
    ).rejects.toThrow(BadRequestException);

    expect(offRampService.handlePaystackTransferSuccess).not.toHaveBeenCalled();
  });

  it('rejects request with missing signature', async () => {
    const body = { event: 'transfer.success', data: { reference: 'X', transfer_code: 'Y', reason: 'X' } };
    const req = makeRequest(body);

    await expect(
      controller.handlePaystackWebhook(req, undefined as any),
    ).rejects.toThrow(BadRequestException);
  });

  // ── transfer.success ──────────────────────────────────────────────────────

  it('dispatches transfer.success event to service', async () => {
    const body = {
      event: 'transfer.success',
      data: { transfer_code: 'TRF_OK', reference: 'OFFRAMP-ABC123', reason: 'OFFRAMP-ABC123', id: 1, status: 'success' },
    };
    const raw = JSON.stringify(body);
    const sig = makeSignature(raw);
    const req = { rawBody: Buffer.from(raw) } as any;

    const result = await controller.handlePaystackWebhook(req, sig);

    expect(result).toEqual({ received: true });
    expect(offRampService.handlePaystackTransferSuccess).toHaveBeenCalledWith(
      'TRF_OK',
      'OFFRAMP-ABC123',
    );
  });

  // ── transfer.failed ──────────────────────────────────────────────────────

  it('dispatches transfer.failed event to service', async () => {
    const body = {
      event: 'transfer.failed',
      data: { transfer_code: 'TRF_FAIL', reference: 'OFFRAMP-ABC456', reason: 'OFFRAMP-ABC456', id: 2, status: 'failed' },
    };
    const raw = JSON.stringify(body);
    const sig = makeSignature(raw);
    const req = { rawBody: Buffer.from(raw) } as any;

    const result = await controller.handlePaystackWebhook(req, sig);

    expect(result).toEqual({ received: true });
    expect(offRampService.handlePaystackTransferFailed).toHaveBeenCalledWith(
      'TRF_FAIL',
      'OFFRAMP-ABC456',
    );
  });

  // ── transfer.reversed ────────────────────────────────────────────────────

  it('treats transfer.reversed as failed', async () => {
    const body = {
      event: 'transfer.reversed',
      data: { transfer_code: 'TRF_REV', reference: 'OFFRAMP-REV', reason: 'OFFRAMP-REV', id: 3, status: 'reversed' },
    };
    const raw = JSON.stringify(body);
    const sig = makeSignature(raw);
    const req = { rawBody: Buffer.from(raw) } as any;

    await controller.handlePaystackWebhook(req, sig);

    expect(offRampService.handlePaystackTransferFailed).toHaveBeenCalledWith(
      'TRF_REV',
      'OFFRAMP-REV',
    );
  });

  // ── unknown event ────────────────────────────────────────────────────────

  it('returns 200 and ignores unhandled event types', async () => {
    const body = {
      event: 'charge.success',
      data: { reference: 'X', transfer_code: '', reason: 'X', id: 4, status: 'success' },
    };
    const raw = JSON.stringify(body);
    const sig = makeSignature(raw);
    const req = { rawBody: Buffer.from(raw) } as any;

    const result = await controller.handlePaystackWebhook(req, sig);

    expect(result).toEqual({ received: true });
    expect(offRampService.handlePaystackTransferSuccess).not.toHaveBeenCalled();
    expect(offRampService.handlePaystackTransferFailed).not.toHaveBeenCalled();
  });

  // ── service error resilience ─────────────────────────────────────────────

  it('returns 200 even when service throws (prevents Paystack retry loop)', async () => {
    offRampService.handlePaystackTransferSuccess.mockRejectedValue(new Error('DB error'));

    const body = {
      event: 'transfer.success',
      data: { transfer_code: 'TRF_X', reference: 'OFFRAMP-X', reason: 'OFFRAMP-X', id: 5, status: 'success' },
    };
    const raw = JSON.stringify(body);
    const sig = makeSignature(raw);
    const req = { rawBody: Buffer.from(raw) } as any;

    const result = await controller.handlePaystackWebhook(req, sig);
    expect(result).toEqual({ received: true });
  });
});
