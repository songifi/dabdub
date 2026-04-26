import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runWithCorrelationId } from '../correlation-id.context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request & { correlationId?: string }, res: Response, next: NextFunction) {
    const headerValue = req.headers['x-correlation-id'];
    const clientCorrelationId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const id = (clientCorrelationId && clientCorrelationId.trim()) || uuidv4();
    req.correlationId = id;
    res.setHeader('X-Correlation-ID', id);
    runWithCorrelationId(id, () => next());
  }
}
