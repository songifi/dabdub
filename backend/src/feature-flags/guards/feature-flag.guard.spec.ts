import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TierName } from '../../tier-config/entities/tier-config.entity';
import { User } from '../../users/entities/user.entity';
import { FeatureFlagService } from '../feature-flag.service';
import { FeatureFlagGuard } from './feature-flag.guard';

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let reflector: Reflector;
  let flags: { isEnabled: jest.Mock };

  const mockUser = {
    id: 'user-1',
    tier: TierName.SILVER,
  } as User;

  const createCtx = (): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    }) as ExecutionContext;

  beforeEach(async () => {
    flags = { isEnabled: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagGuard,
        Reflector,
        { provide: FeatureFlagService, useValue: flags },
      ],
    }).compile();
    guard = module.get(FeatureFlagGuard);
    reflector = module.get(Reflector);
  });

  it('returns 404 (NotFoundException) when flag is off, not 403', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('beta_feature');
    flags.isEnabled.mockResolvedValue(false);

    await expect(guard.canActivate(createCtx())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('allows when flag is on', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('beta_feature');
    flags.isEnabled.mockResolvedValue(true);

    await expect(guard.canActivate(createCtx())).resolves.toBe(true);
    expect(flags.isEnabled).toHaveBeenCalledWith(
      'beta_feature',
      mockUser.id,
      mockUser.tier,
    );
  });

  it('allows when no metadata key', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(createCtx())).resolves.toBe(true);
    expect(flags.isEnabled).not.toHaveBeenCalled();
  });
});
