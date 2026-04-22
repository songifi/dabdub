import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

type RequestWithCorrelation = Request & { correlationId?: string };

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelation, res: Response, next: NextFunction): void {
    const header = req.header('x-correlation-id');
    const correlationId = header && header.trim().length > 0 ? header : uuidv4();

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}

