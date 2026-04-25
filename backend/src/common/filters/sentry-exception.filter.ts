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
interface RequestWithUser {
  user?: { id: string; email?: string; merchantId?: string; isMerchant?: boolean; isAdmin?: boolean };
  url?: string;
  method?: string;
  headers?: Record<string, unknown>;
}

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

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

        if (user.email) {
          userContext.email = user.email;
        }
        if (user.merchantId) {
          userContext.merchantId = user.merchantId;
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

