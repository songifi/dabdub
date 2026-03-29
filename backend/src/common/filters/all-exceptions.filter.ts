import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';
import { formatValidationErrors } from '../utils/format-validation-error.util';
import { QueryFailedError } from 'typeorm';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request.url;
    const requestId = request.headers['x-request-id'] || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Something went wrong';
    let details: any = undefined;

    // ✅ AppException
    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    }

    // ✅ Validation Errors
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();

      if (Array.isArray(res.message)) {
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = res.message.map((msg) => ({
          field: msg.split(' ')[0],
          message: msg,
        }));
      } else {
        message = res.message || message;
      }
    }

    // ✅ TypeORM Unique Constraint
    else if (exception instanceof QueryFailedError) {
      const err: any = exception;

      if (err.code === '23505') {
        status = HttpStatus.CONFLICT;
        code = 'RESOURCE_ALREADY_EXISTS';
        message = 'Resource already exists';
      }
    }

    // ✅ Logging
    if (status >= 500) {
      this.logger.error(exception);
    } else {
      this.logger.warn(exception);
    }

    // ❌ Never expose stack in production
    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp,
      path,
      requestId,
    });
  }
}