import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request & { correlationId?: string }, res: Response, next: NextFunction) {
    const id = (req.headers['x-correlation-id'] as string) || uuidv4();
    req.correlationId = id;
    res.setHeader('X-Correlation-Id', id);
    next();
  }
}
