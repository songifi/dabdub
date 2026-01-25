import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorCodeMetadata } from '../error-codes.enum';
import { ErrorResponseDto, ValidationError } from '../error-response.dto';

/**
 * Base HTTP Exception with Error Code Support
 */
export class BaseHttpException extends HttpException {
  public readonly errorCode: ErrorCode;
  public readonly userMessage: string;
  public readonly metadata?: Record<string, any>;

  constructor(
    errorCode: ErrorCode,
    message?: string,
    metadata?: Record<string, any>,
  ) {
    const metadataForCode = ErrorCodeMetadata[errorCode];
    const httpStatus =
      metadataForCode?.httpStatus || HttpStatus.INTERNAL_SERVER_ERROR;
    const defaultMessage = metadataForCode?.message || 'An error occurred';
    const userMessage = metadataForCode?.userMessage || defaultMessage;

    super(
      {
        success: false,
        errorCode,
        message: message || userMessage,
        userMessage,
        timestamp: new Date().toISOString(),
        ...(metadata && { metadata }),
      },
      httpStatus,
    );

    this.errorCode = errorCode;
    this.userMessage = userMessage;
    this.metadata = metadata;
  }

  /**
   * Convert exception to ErrorResponseDto
   */
  toErrorResponse(requestId?: string, includeStack = false): ErrorResponseDto {
    const response = this.getResponse() as any;
    return new ErrorResponseDto({
      errorCode: this.errorCode,
      message: this.userMessage,
      details:
        response.message !== this.userMessage ? response.message : undefined,
      requestId,
      timestamp: response.timestamp,
      stack: includeStack ? this.stack : undefined,
      metadata: this.metadata,
    });
  }
}

/**
 * Bad Request Exception (400)
 */
export class BadRequestException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.VALIDATION_ERROR, message, metadata);
  }
}

/**
 * Unauthorized Exception (401)
 */
export class UnauthorizedException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.UNAUTHORIZED, message, metadata);
  }
}

/**
 * Forbidden Exception (403)
 */
export class ForbiddenException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.FORBIDDEN, message, metadata);
  }
}

/**
 * Not Found Exception (404)
 */
export class NotFoundException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.NOT_FOUND, message, metadata);
  }
}

/**
 * Conflict Exception (409)
 */
export class ConflictException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.DUPLICATE_ENTRY, message, metadata);
  }
}

/**
 * Unprocessable Entity Exception (422)
 */
export class UnprocessableEntityException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.VALIDATION_ERROR, message, metadata);
  }
}

/**
 * Locked Exception (423)
 */
export class LockedException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.WALLET_LOCKED, message, metadata);
  }
}

/**
 * Too Many Requests Exception (429)
 */
export class TooManyRequestsException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, metadata);
  }
}

/**
 * Internal Server Error Exception (500)
 */
export class InternalServerErrorException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.INTERNAL_SERVER_ERROR, message, metadata);
  }
}

/**
 * Bad Gateway Exception (502)
 */
export class BadGatewayException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.EXTERNAL_SERVICE_ERROR, message, metadata);
  }
}

/**
 * Service Unavailable Exception (503)
 */
export class ServiceUnavailableException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.SERVICE_UNAVAILABLE, message, metadata);
  }
}

/**
 * Gateway Timeout Exception (504)
 */
export class GatewayTimeoutException extends BaseHttpException {
  constructor(message?: string, metadata?: Record<string, any>) {
    super(ErrorCode.TIMEOUT, message, metadata);
  }
}

/**
 * Validation Exception with detailed field errors
 */
export class ValidationException extends BaseHttpException {
  public readonly validationErrors: ValidationError[];

  constructor(
    validationErrors: ValidationError[],
    message?: string,
    metadata?: Record<string, any>,
  ) {
    super(ErrorCode.VALIDATION_ERROR, message, metadata);
    this.validationErrors = validationErrors;
  }

  toErrorResponse(requestId?: string, includeStack = false): ErrorResponseDto {
    const response = super.toErrorResponse(requestId, includeStack);
    response.validationErrors = this.validationErrors;
    return response;
  }
}
