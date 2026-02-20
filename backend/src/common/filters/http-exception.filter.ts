import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../errors/error-response.dto';
import { BaseHttpException } from '../errors/exceptions/http-exceptions';
import { ErrorCode, ErrorCodeMetadata } from '../errors/error-codes.enum';
import * as Sentry from '@sentry/node';

/**
 * Global HTTP Exception Filter
 * Catches all HTTP exceptions and formats them into standardized error responses
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // Extract request ID from request (set by middleware)
    const requestId = (request as any).requestId;

    let errorResponse: ErrorResponseDto;

    // Handle custom BaseHttpException
    if (exception instanceof BaseHttpException) {
      errorResponse = exception.toErrorResponse(requestId, isDevelopment);
    } else {
      // Handle standard NestJS HttpException
      const exceptionResponse = exception.getResponse();
      const errorCode = this.determineErrorCode(status);
      const metadata = ErrorCodeMetadata[errorCode];

      const retryAfter =
        status === HttpStatus.TOO_MANY_REQUESTS &&
        typeof exceptionResponse === 'object'
          ? (exceptionResponse as any)?.retryAfter
          : undefined;

      errorResponse = new ErrorResponseDto({
        errorCode,
        message:
          (typeof exceptionResponse === 'object' &&
            (exceptionResponse as any)?.message) ||
          metadata?.userMessage ||
          'An error occurred',
        details:
          typeof exceptionResponse === 'string' ? exceptionResponse : undefined,
        requestId,
        timestamp: new Date().toISOString(),
        stack: isDevelopment ? exception.stack : undefined,
        retryAfter,
        metadata:
          typeof exceptionResponse === 'object'
            ? (exceptionResponse as any)
            : undefined,
      });
    }

    // Log error with context
    this.logError(exception, request, errorResponse);

    // Send error to Sentry (only for server errors)
    if (status >= 500) {
      Sentry.captureException(exception, {
        tags: {
          errorCode: errorResponse.errorCode,
          requestId: errorResponse.requestId,
        },
        extra: {
          request: {
            method: request.method,
            url: request.url,
            headers: this.sanitizeHeaders(request.headers),
            body: this.sanitizeBody(request.body),
          },
          errorResponse: errorResponse,
        },
      });
    }

    // Send response
    response.status(status).json(errorResponse);
  }

  /**
   * Determine error code based on HTTP status
   */
  private determineErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.DUPLICATE_ENTRY;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ErrorCode.INTERNAL_SERVER_ERROR;
      case HttpStatus.BAD_GATEWAY:
        return ErrorCode.EXTERNAL_SERVICE_ERROR;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.SERVICE_UNAVAILABLE;
      case HttpStatus.GATEWAY_TIMEOUT:
        return ErrorCode.TIMEOUT;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Log error with context
   */
  private logError(
    exception: HttpException,
    request: Request,
    errorResponse: ErrorResponseDto,
  ): void {
    const logContext = {
      errorCode: errorResponse.errorCode,
      requestId: errorResponse.requestId,
      method: request.method,
      url: request.url,
      statusCode: exception.getStatus(),
      userAgent: request.get('user-agent'),
      ip: request.ip,
    };

    if (exception.getStatus() >= 500) {
      this.logger.error(
        {
          message: errorResponse.details || errorResponse.message,
          stack: exception.stack,
          ...logContext,
        },
        'HTTP Exception',
      );
    } else {
      this.logger.warn(
        {
          message: errorResponse.message,
          ...logContext,
        },
        'HTTP Exception',
      );
    }
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   */
  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];
    const sanitized = { ...headers };
    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '********';
      }
    });
    return sanitized;
  }

  /**
   * Sanitize request body for logging (remove sensitive data)
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }
    const sensitiveFields = [
      'password',
      'passwordConfirm',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'creditCard',
      'cvv',
    ];
    const sanitized = { ...body };
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '********';
      }
    });
    return sanitized;
  }
}
