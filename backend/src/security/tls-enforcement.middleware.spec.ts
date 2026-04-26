import { HttpStatus } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TlsEnforcementMiddleware } from './tls-enforcement.middleware';

describe('TlsEnforcementMiddleware', () => {
  let middleware: TlsEnforcementMiddleware;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    middleware = new TlsEnforcementMiddleware();
    req = {
      method: 'GET',
      originalUrl: '/test',
      ip: '127.0.0.1',
      headers: {},
      secure: false,
      socket: {},
    } as Partial<Request>;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as Partial<Response>;
    next = jest.fn();
  });

  it('rejects non-secure requests', () => {
    middleware.use(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.UPGRADE_REQUIRED);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.UPGRADE_REQUIRED,
      message: 'HTTPS is required for all requests.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows secure requests with x-forwarded-proto https', () => {
    req.headers = { 'x-forwarded-proto': 'https' } as Record<string, string>;
    middleware.use(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});
