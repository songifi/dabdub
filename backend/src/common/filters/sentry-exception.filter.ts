import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';
import type { User } from '../../users/entities/user.entity';
import type { Admin } from '../../admin/entities/admin.entity';

interface RequestWithUser {
  user?: User | Admin;
  url?: string;
  method?: string;
  headers?: Record<string, unknown>;
}

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithUser>();
    const response = ctx.getResponse();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Only send 5xx errors to Sentry; 4xx are client errors
    if (httpStatus >= 500) {
      await this.captureException(exception, request);
    }

    const responseBody = {
      statusCode: httpStatus,
      message: exception instanceof HttpException ? exception.message : 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    httpAdapter.reply(response, responseBody, httpStatus);
  }

  private async captureException(
    exception: unknown,
    request: RequestWithUser,
  ): Promise<void> {
    Sentry.withScope(async (scope) => {
      const user = request.user;

      if (user) {
        const userContext: { id: string; email?: string; merchantId?: string } = {
          id: user.id,
        };

        if ('email' in user) {
          userContext.email = user.email;
        }

        // Enrich with merchantId if user is a merchant (only on error path)
        if ('isMerchant' in user && user.isMerchant) {
          try {
            const merchant = await this.merchantRepo.findOne({
              where: { userId: user.id },
              select: ['id'],
            });
            if (merchant) {
              userContext.merchantId = merchant.id;
            }
          } catch {
            // Ignore merchant lookup failures during error reporting
          }
        }

        scope.setUser(userContext);
      }

      scope.setContext('http_request', {
        url: request.url,
        method: request.method,
      });

      Sentry.captureException(exception);
    });
  }
}

