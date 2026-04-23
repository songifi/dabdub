import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { MerchantRole } from '../../merchants/entities/merchant.entity';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (userRole?: MerchantRole, requiredRoles?: MerchantRole[]): ExecutionContext => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(requiredRoles);
    
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userRole ? { role: userRole } : null,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  it('should allow access if no roles are required', () => {
    const context = createMockContext(MerchantRole.MERCHANT, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has required role', () => {
    const context = createMockContext(MerchantRole.ADMIN, [MerchantRole.ADMIN]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user has wrong role', () => {
    const context = createMockContext(MerchantRole.MERCHANT, [MerchantRole.ADMIN]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if no user in request', () => {
    const context = createMockContext(undefined, [MerchantRole.ADMIN]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
