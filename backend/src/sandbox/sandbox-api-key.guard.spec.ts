import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { SandboxApiKeyGuard } from './sandbox-api-key.guard';

describe('SandboxApiKeyGuard', () => {
  it('rejects ck_live_ keys for sandbox endpoints', async () => {
    const guard = new SandboxApiKeyGuard(
      { findOne: jest.fn() } as any,
      {
        isSandboxRequest: jest.fn().mockReturnValue(false),
        extractMerchantIdFromApiKey: jest.fn(),
      } as any,
    );

    const req = {
      headers: {
        'x-api-key': 'ck_live_abcdef',
      },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
