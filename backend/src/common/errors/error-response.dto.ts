import { ErrorCode } from './error-codes.enum';

/**
 * Standardized Error Response DTO
 * Provides consistent error response structure across the application
 */
export class ErrorResponseDto {
  /**
   * Indicates if the request was successful (always false for errors)
   */
  success: boolean;

  /**
   * Error code from ErrorCode enum
   */
  errorCode: string;

  /**
   * User-friendly error message (safe to display to end users)
   */
  message: string;

  /**
   * Technical error message (for debugging, may contain sensitive info)
   */
  details?: string;

  /**
   * Validation errors (for validation failures)
   */
  validationErrors?: ValidationError[];

  /**
   * Request ID for tracking (from middleware)
   */
  requestId?: string;

  /**
   * Timestamp of the error
   */
  timestamp: string;

  /**
   * Stack trace (only in development)
   */
  stack?: string;

  /**
   * Seconds until the client may retry (set on 429 responses)
   */
  retryAfter?: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  constructor(data: Partial<ErrorResponseDto>) {
    this.success = false;
    this.errorCode = data.errorCode || ErrorCode.INTERNAL_SERVER_ERROR;
    this.message = data.message || 'An error occurred';
    this.details = data.details;
    this.validationErrors = data.validationErrors;
    this.requestId = data.requestId;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.stack = data.stack;
    this.retryAfter = data.retryAfter;
    this.metadata = data.metadata;
  }
}

/**
 * Validation Error DTO
 * Used for detailed validation error messages
 */
export class ValidationError {
  /**
   * Field name that failed validation
   */
  field: string;

  /**
   * Validation error message
   */
  message: string;

  /**
   * Rejected value (may be masked for sensitive data)
   */
  rejectedValue?: any;

  /**
   * Validation constraints that failed
   */
  constraints?: Record<string, string>;

  constructor(data: Partial<ValidationError>) {
    this.field = data.field || '';
    this.message = data.message || 'Validation failed';
    this.rejectedValue = data.rejectedValue;
    this.constraints = data.constraints;
  }
}
