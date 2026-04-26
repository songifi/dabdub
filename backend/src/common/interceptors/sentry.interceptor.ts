import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import * as Sentry from '@sentry/nestjs';
import type { User } from '../../users/entities/user.entity';
import type { Admin } from '../../admin/entities/admin.entity';

interface RequestWithUser {
  user?: User | Admin;
}

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    Sentry.withScope((scope) => {
      if (user) {
        scope.setUser({
          id: user.id,
          email: 'email' in user ? user.email : undefined,
        });
        if ('isMerchant' in user && user.isMerchant) {
          scope.setTag('user_type', 'merchant');
        } else if ('isAdmin' in user && user.isAdmin) {
          scope.setTag('user_type', 'admin');
        } else {
          scope.setTag('user_type', 'user');
        }
      }
      scope.setTag('handler', `${context.getClass().name}.${context.getHandler().name}`);
    });

    return next.handle();
  }
}

