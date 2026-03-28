import { Injectable, NestMiddleware } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response, NextFunction } from 'express';

interface User {
  id: string;
  username: string;
  email?: string;
  role?: string;
}

interface RequestWithUser extends Request {
  user?: User;
}

@Injectable()
export class SentryUserMiddleware implements NestMiddleware {
  use(req: RequestWithUser, res: Response, next: NextFunction): void {
    if (req.user) {
      Sentry.setUser({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
      });
    }

    next();
  }
}
