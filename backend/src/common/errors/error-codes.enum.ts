/**
 * Error Code Enumeration System
 *
 * Error codes follow the pattern: [CATEGORY][SUB_CATEGORY][NUMBER]
 *
 * Categories:
 * - 1xxx: General/System Errors
 * - 2xxx: Validation Errors
 * - 3xxx: Authentication/Authorization Errors
 * - 4xxx: Business Logic Errors
 * - 5xxx: External Service Errors
 * - 6xxx: Database Errors
 * - 7xxx: Payment/Transaction Errors
 */

export enum ErrorCode {
  // General/System Errors (1xxx)
  INTERNAL_SERVER_ERROR = '1000',
  NOT_IMPLEMENTED = '1001',
  SERVICE_UNAVAILABLE = '1002',
  TIMEOUT = '1003',
  RATE_LIMIT_EXCEEDED = '1004',

  // Validation Errors (2xxx)
  VALIDATION_ERROR = '2000',
  INVALID_INPUT = '2001',
  MISSING_REQUIRED_FIELD = '2002',
  INVALID_FORMAT = '2003',
  INVALID_EMAIL = '2004',
  INVALID_PHONE = '2005',
  INVALID_DATE = '2006',
  VALUE_TOO_LONG = '2007',
  VALUE_TOO_SHORT = '2008',
  INVALID_RANGE = '2009',

  // Authentication/Authorization Errors (3xxx)
  UNAUTHORIZED = '3000',
  FORBIDDEN = '3001',
  INVALID_CREDENTIALS = '3002',
  TOKEN_EXPIRED = '3003',
  TOKEN_INVALID = '3004',
  SESSION_EXPIRED = '3005',
  INSUFFICIENT_PERMISSIONS = '3006',

  // Business Logic Errors (4xxx)
  NOT_FOUND = '4000',
  RESOURCE_NOT_FOUND = '4001',
  USER_NOT_FOUND = '4002',
  WALLET_NOT_FOUND = '4003',
  TRANSACTION_NOT_FOUND = '4004',
  DUPLICATE_ENTRY = '4005',
  RESOURCE_ALREADY_EXISTS = '4006',
  OPERATION_NOT_ALLOWED = '4007',
  INSUFFICIENT_FUNDS = '4008',
  WALLET_LOCKED = '4009',
  TRANSACTION_LIMIT_EXCEEDED = '4010',
  INVALID_TRANSACTION_STATE = '4011',

  // External Service Errors (5xxx)
  EXTERNAL_SERVICE_ERROR = '5000',
  EXTERNAL_SERVICE_TIMEOUT = '5001',
  EXTERNAL_SERVICE_UNAVAILABLE = '5002',
  API_RATE_LIMIT_EXCEEDED = '5003',

  // Database Errors (6xxx)
  DATABASE_ERROR = '6000',
  DATABASE_CONNECTION_ERROR = '6001',
  DATABASE_QUERY_ERROR = '6002',
  DATABASE_TRANSACTION_ERROR = '6003',
  CONSTRAINT_VIOLATION = '6004',

  // Payment/Transaction Errors (7xxx)
  PAYMENT_ERROR = '7000',
  PAYMENT_FAILED = '7001',
  PAYMENT_DECLINED = '7002',
  PAYMENT_PROCESSING_ERROR = '7003',
  INVALID_PAYMENT_METHOD = '7004',
  PAYMENT_TIMEOUT = '7005',
}

/**
 * Error Code Metadata
 * Maps error codes to user-friendly messages and HTTP status codes
 */
export const ErrorCodeMetadata: Record<
  ErrorCode,
  { message: string; httpStatus: number; userMessage: string }
> = {
  // General/System Errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: {
    message: 'An internal server error occurred',
    httpStatus: 500,
    userMessage: 'Something went wrong. Please try again later.',
  },
  [ErrorCode.NOT_IMPLEMENTED]: {
    message: 'This feature is not yet implemented',
    httpStatus: 501,
    userMessage: 'This feature is currently unavailable.',
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    message: 'Service is temporarily unavailable',
    httpStatus: 503,
    userMessage: 'Service is temporarily unavailable. Please try again later.',
  },
  [ErrorCode.TIMEOUT]: {
    message: 'Request timeout',
    httpStatus: 504,
    userMessage: 'The request took too long to process. Please try again.',
  },
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    message: 'Rate limit exceeded',
    httpStatus: 429,
    userMessage: 'Too many requests. Please try again later.',
  },

  // Validation Errors
  [ErrorCode.VALIDATION_ERROR]: {
    message: 'Validation error',
    httpStatus: 400,
    userMessage: 'Please check your input and try again.',
  },
  [ErrorCode.INVALID_INPUT]: {
    message: 'Invalid input provided',
    httpStatus: 400,
    userMessage: 'The provided input is invalid.',
  },
  [ErrorCode.MISSING_REQUIRED_FIELD]: {
    message: 'Required field is missing',
    httpStatus: 400,
    userMessage: 'Please provide all required fields.',
  },
  [ErrorCode.INVALID_FORMAT]: {
    message: 'Invalid format',
    httpStatus: 400,
    userMessage: 'The provided format is invalid.',
  },
  [ErrorCode.INVALID_EMAIL]: {
    message: 'Invalid email address',
    httpStatus: 400,
    userMessage: 'Please provide a valid email address.',
  },
  [ErrorCode.INVALID_PHONE]: {
    message: 'Invalid phone number',
    httpStatus: 400,
    userMessage: 'Please provide a valid phone number.',
  },
  [ErrorCode.INVALID_DATE]: {
    message: 'Invalid date',
    httpStatus: 400,
    userMessage: 'Please provide a valid date.',
  },
  [ErrorCode.VALUE_TOO_LONG]: {
    message: 'Value is too long',
    httpStatus: 400,
    userMessage: 'The provided value exceeds the maximum length.',
  },
  [ErrorCode.VALUE_TOO_SHORT]: {
    message: 'Value is too short',
    httpStatus: 400,
    userMessage: 'The provided value is too short.',
  },
  [ErrorCode.INVALID_RANGE]: {
    message: 'Invalid range',
    httpStatus: 400,
    userMessage: 'The provided range is invalid.',
  },

  // Authentication/Authorization Errors
  [ErrorCode.UNAUTHORIZED]: {
    message: 'Unauthorized access',
    httpStatus: 401,
    userMessage: 'You are not authorized to access this resource.',
  },
  [ErrorCode.FORBIDDEN]: {
    message: 'Access forbidden',
    httpStatus: 403,
    userMessage: 'You do not have permission to perform this action.',
  },
  [ErrorCode.INVALID_CREDENTIALS]: {
    message: 'Invalid credentials',
    httpStatus: 401,
    userMessage: 'Invalid email or password.',
  },
  [ErrorCode.TOKEN_EXPIRED]: {
    message: 'Token has expired',
    httpStatus: 401,
    userMessage: 'Your session has expired. Please log in again.',
  },
  [ErrorCode.TOKEN_INVALID]: {
    message: 'Invalid token',
    httpStatus: 401,
    userMessage: 'Invalid authentication token.',
  },
  [ErrorCode.SESSION_EXPIRED]: {
    message: 'Session has expired',
    httpStatus: 401,
    userMessage: 'Your session has expired. Please log in again.',
  },
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: {
    message: 'Insufficient permissions',
    httpStatus: 403,
    userMessage: 'You do not have sufficient permissions for this action.',
  },

  // Business Logic Errors
  [ErrorCode.NOT_FOUND]: {
    message: 'Resource not found',
    httpStatus: 404,
    userMessage: 'The requested resource was not found.',
  },
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    message: 'Resource not found',
    httpStatus: 404,
    userMessage: 'The requested resource was not found.',
  },
  [ErrorCode.USER_NOT_FOUND]: {
    message: 'User not found',
    httpStatus: 404,
    userMessage: 'User not found.',
  },
  [ErrorCode.WALLET_NOT_FOUND]: {
    message: 'Wallet not found',
    httpStatus: 404,
    userMessage: 'Wallet not found.',
  },
  [ErrorCode.TRANSACTION_NOT_FOUND]: {
    message: 'Transaction not found',
    httpStatus: 404,
    userMessage: 'Transaction not found.',
  },
  [ErrorCode.DUPLICATE_ENTRY]: {
    message: 'Duplicate entry',
    httpStatus: 409,
    userMessage: 'This resource already exists.',
  },
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: {
    message: 'Resource already exists',
    httpStatus: 409,
    userMessage: 'This resource already exists.',
  },
  [ErrorCode.OPERATION_NOT_ALLOWED]: {
    message: 'Operation not allowed',
    httpStatus: 403,
    userMessage: 'This operation is not allowed.',
  },
  [ErrorCode.INSUFFICIENT_FUNDS]: {
    message: 'Insufficient funds',
    httpStatus: 400,
    userMessage:
      'You do not have sufficient funds to complete this transaction.',
  },
  [ErrorCode.WALLET_LOCKED]: {
    message: 'Wallet is locked',
    httpStatus: 423,
    userMessage: 'Your wallet is currently locked. Please contact support.',
  },
  [ErrorCode.TRANSACTION_LIMIT_EXCEEDED]: {
    message: 'Transaction limit exceeded',
    httpStatus: 400,
    userMessage: 'You have exceeded the transaction limit.',
  },
  [ErrorCode.INVALID_TRANSACTION_STATE]: {
    message: 'Invalid transaction state',
    httpStatus: 400,
    userMessage: 'The transaction is in an invalid state.',
  },

  // External Service Errors
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: {
    message: 'External service error',
    httpStatus: 502,
    userMessage:
      'An error occurred while processing your request. Please try again.',
  },
  [ErrorCode.EXTERNAL_SERVICE_TIMEOUT]: {
    message: 'External service timeout',
    httpStatus: 504,
    userMessage:
      'The service is taking longer than expected. Please try again.',
  },
  [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: {
    message: 'External service unavailable',
    httpStatus: 503,
    userMessage:
      'The service is temporarily unavailable. Please try again later.',
  },
  [ErrorCode.API_RATE_LIMIT_EXCEEDED]: {
    message: 'API rate limit exceeded',
    httpStatus: 429,
    userMessage: 'Too many requests. Please try again later.',
  },

  // Database Errors
  [ErrorCode.DATABASE_ERROR]: {
    message: 'Database error',
    httpStatus: 500,
    userMessage:
      'An error occurred while processing your request. Please try again.',
  },
  [ErrorCode.DATABASE_CONNECTION_ERROR]: {
    message: 'Database connection error',
    httpStatus: 503,
    userMessage: 'Service is temporarily unavailable. Please try again later.',
  },
  [ErrorCode.DATABASE_QUERY_ERROR]: {
    message: 'Database query error',
    httpStatus: 500,
    userMessage:
      'An error occurred while processing your request. Please try again.',
  },
  [ErrorCode.DATABASE_TRANSACTION_ERROR]: {
    message: 'Database transaction error',
    httpStatus: 500,
    userMessage:
      'An error occurred while processing your request. Please try again.',
  },
  [ErrorCode.CONSTRAINT_VIOLATION]: {
    message: 'Database constraint violation',
    httpStatus: 400,
    userMessage: 'The provided data violates a constraint.',
  },

  // Payment/Transaction Errors
  [ErrorCode.PAYMENT_ERROR]: {
    message: 'Payment error',
    httpStatus: 500,
    userMessage:
      'An error occurred while processing your payment. Please try again.',
  },
  [ErrorCode.PAYMENT_FAILED]: {
    message: 'Payment failed',
    httpStatus: 402,
    userMessage:
      'Your payment could not be processed. Please check your payment method.',
  },
  [ErrorCode.PAYMENT_DECLINED]: {
    message: 'Payment declined',
    httpStatus: 402,
    userMessage:
      'Your payment was declined. Please try a different payment method.',
  },
  [ErrorCode.PAYMENT_PROCESSING_ERROR]: {
    message: 'Payment processing error',
    httpStatus: 500,
    userMessage:
      'An error occurred while processing your payment. Please try again.',
  },
  [ErrorCode.INVALID_PAYMENT_METHOD]: {
    message: 'Invalid payment method',
    httpStatus: 400,
    userMessage: 'The provided payment method is invalid.',
  },
  [ErrorCode.PAYMENT_TIMEOUT]: {
    message: 'Payment timeout',
    httpStatus: 504,
    userMessage: 'The payment request timed out. Please try again.',
  },
};
