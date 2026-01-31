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

  // Payment Request Errors (8xxx)
  PAYMENT_REQUEST_NOT_FOUND = '8000',
  PAYMENT_REQUEST_EXPIRED = '8001',
  PAYMENT_REQUEST_INVALID_STATUS = '8002',
  PAYMENT_REQUEST_DUPLICATE = '8003',
  PAYMENT_REQUEST_AMOUNT_TOO_LOW = '8004',
  PAYMENT_REQUEST_AMOUNT_TOO_HIGH = '8005',
  PAYMENT_REQUEST_ALREADY_PROCESSED = '8006',
  PAYMENT_REQUEST_CANNOT_CANCEL = '8007',
  PAYMENT_REQUEST_QR_FAILED = '8008',

  // Stellar Errors (81xx)
  STELLAR_CONTRACT_ERROR = '8100',
  STELLAR_NETWORK_ERROR = '8101',

  // Merchant Errors (9xxx)
  MERCHANT_NOT_FOUND = '9000',
  MERCHANT_ALREADY_EXISTS = '9001',
  MERCHANT_SUSPENDED = '9002',
  MERCHANT_CLOSED = '9003',
  MERCHANT_INACTIVE = '9004',
  MERCHANT_INVALID_STATUS = '9005',
  MERCHANT_EMAIL_NOT_VERIFIED = '9006',
  MERCHANT_EMAIL_ALREADY_VERIFIED = '9007',
  MERCHANT_VERIFICATION_TOKEN_INVALID = '9008',
  MERCHANT_VERIFICATION_TOKEN_EXPIRED = '9009',

  // KYC Errors (91xx)
  KYC_NOT_STARTED = '9100',
  KYC_ALREADY_SUBMITTED = '9101',
  KYC_ALREADY_APPROVED = '9102',
  KYC_DOCUMENT_REQUIRED = '9103',
  KYC_DOCUMENT_INVALID = '9104',
  KYC_VERIFICATION_FAILED = '9105',
  KYC_STATUS_INVALID = '9106',

  // Bank Account Errors (92xx)
  BANK_ACCOUNT_NOT_FOUND = '9200',
  BANK_ACCOUNT_VERIFICATION_FAILED = '9201',
  BANK_ACCOUNT_ALREADY_VERIFIED = '9202',
  BANK_ACCOUNT_INVALID = '9203',

  // API Quota Errors (93xx)
  API_QUOTA_EXCEEDED = '9300',
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

  // Payment Request Errors
  [ErrorCode.PAYMENT_REQUEST_NOT_FOUND]: {
    message: 'Payment request not found',
    httpStatus: 404,
    userMessage: 'The payment request was not found.',
  },
  [ErrorCode.PAYMENT_REQUEST_EXPIRED]: {
    message: 'Payment request has expired',
    httpStatus: 410,
    userMessage: 'This payment request has expired.',
  },
  [ErrorCode.PAYMENT_REQUEST_INVALID_STATUS]: {
    message: 'Invalid payment request status transition',
    httpStatus: 400,
    userMessage:
      'This action is not allowed for the current payment request status.',
  },
  [ErrorCode.PAYMENT_REQUEST_DUPLICATE]: {
    message: 'Duplicate payment request',
    httpStatus: 409,
    userMessage: 'A payment request with this idempotency key already exists.',
  },
  [ErrorCode.PAYMENT_REQUEST_AMOUNT_TOO_LOW]: {
    message: 'Payment request amount is below the minimum',
    httpStatus: 400,
    userMessage: 'The payment amount is below the minimum allowed.',
  },
  [ErrorCode.PAYMENT_REQUEST_AMOUNT_TOO_HIGH]: {
    message: 'Payment request amount exceeds the maximum',
    httpStatus: 400,
    userMessage: 'The payment amount exceeds the maximum allowed.',
  },
  [ErrorCode.PAYMENT_REQUEST_ALREADY_PROCESSED]: {
    message: 'Payment request has already been processed',
    httpStatus: 409,
    userMessage: 'This payment request has already been processed.',
  },
  [ErrorCode.PAYMENT_REQUEST_CANNOT_CANCEL]: {
    message: 'Payment request cannot be cancelled',
    httpStatus: 400,
    userMessage:
      'This payment request cannot be cancelled in its current state.',
  },
  [ErrorCode.PAYMENT_REQUEST_QR_FAILED]: {
    message: 'Failed to generate QR code',
    httpStatus: 500,
    userMessage: 'Failed to generate the QR code. Please try again.',
  },

  // Stellar Errors
  [ErrorCode.STELLAR_CONTRACT_ERROR]: {
    message: 'Stellar smart contract error',
    httpStatus: 502,
    userMessage:
      'An error occurred communicating with the blockchain. Please try again.',
  },
  [ErrorCode.STELLAR_NETWORK_ERROR]: {
    message: 'Stellar network error',
    httpStatus: 503,
    userMessage:
      'The Stellar network is currently unavailable. Please try again later.',
  },

  // Merchant Errors
  [ErrorCode.MERCHANT_NOT_FOUND]: {
    message: 'Merchant not found',
    httpStatus: 404,
    userMessage: 'The merchant account was not found.',
  },
  [ErrorCode.MERCHANT_ALREADY_EXISTS]: {
    message: 'Merchant already exists',
    httpStatus: 409,
    userMessage: 'A merchant account with this email already exists.',
  },
  [ErrorCode.MERCHANT_SUSPENDED]: {
    message: 'Merchant account suspended',
    httpStatus: 403,
    userMessage: 'Your merchant account has been suspended. Please contact support.',
  },
  [ErrorCode.MERCHANT_CLOSED]: {
    message: 'Merchant account closed',
    httpStatus: 403,
    userMessage: 'This merchant account has been closed.',
  },
  [ErrorCode.MERCHANT_INACTIVE]: {
    message: 'Merchant account inactive',
    httpStatus: 403,
    userMessage: 'Your merchant account is inactive. Please complete the verification process.',
  },
  [ErrorCode.MERCHANT_INVALID_STATUS]: {
    message: 'Invalid merchant status transition',
    httpStatus: 400,
    userMessage: 'This action is not allowed for the current merchant status.',
  },
  [ErrorCode.MERCHANT_EMAIL_NOT_VERIFIED]: {
    message: 'Email not verified',
    httpStatus: 403,
    userMessage: 'Please verify your email address to continue.',
  },
  [ErrorCode.MERCHANT_EMAIL_ALREADY_VERIFIED]: {
    message: 'Email already verified',
    httpStatus: 400,
    userMessage: 'Your email address has already been verified.',
  },
  [ErrorCode.MERCHANT_VERIFICATION_TOKEN_INVALID]: {
    message: 'Invalid verification token',
    httpStatus: 400,
    userMessage: 'The verification token is invalid.',
  },
  [ErrorCode.MERCHANT_VERIFICATION_TOKEN_EXPIRED]: {
    message: 'Verification token expired',
    httpStatus: 400,
    userMessage: 'The verification token has expired. Please request a new one.',
  },

  // KYC Errors
  [ErrorCode.KYC_NOT_STARTED]: {
    message: 'KYC not started',
    httpStatus: 400,
    userMessage: 'KYC verification has not been started.',
  },
  [ErrorCode.KYC_ALREADY_SUBMITTED]: {
    message: 'KYC already submitted',
    httpStatus: 400,
    userMessage: 'KYC documents have already been submitted and are under review.',
  },
  [ErrorCode.KYC_ALREADY_APPROVED]: {
    message: 'KYC already approved',
    httpStatus: 400,
    userMessage: 'Your KYC verification has already been approved.',
  },
  [ErrorCode.KYC_DOCUMENT_REQUIRED]: {
    message: 'KYC document required',
    httpStatus: 400,
    userMessage: 'Please upload the required KYC documents.',
  },
  [ErrorCode.KYC_DOCUMENT_INVALID]: {
    message: 'KYC document invalid',
    httpStatus: 400,
    userMessage: 'The uploaded document is invalid or unreadable.',
  },
  [ErrorCode.KYC_VERIFICATION_FAILED]: {
    message: 'KYC verification failed',
    httpStatus: 400,
    userMessage: 'KYC verification failed. Please review and resubmit your documents.',
  },
  [ErrorCode.KYC_STATUS_INVALID]: {
    message: 'Invalid KYC status transition',
    httpStatus: 400,
    userMessage: 'This action is not allowed for the current KYC status.',
  },

  // Bank Account Errors
  [ErrorCode.BANK_ACCOUNT_NOT_FOUND]: {
    message: 'Bank account not found',
    httpStatus: 404,
    userMessage: 'No bank account found. Please add your bank account details.',
  },
  [ErrorCode.BANK_ACCOUNT_VERIFICATION_FAILED]: {
    message: 'Bank account verification failed',
    httpStatus: 400,
    userMessage: 'Bank account verification failed. Please check your details and try again.',
  },
  [ErrorCode.BANK_ACCOUNT_ALREADY_VERIFIED]: {
    message: 'Bank account already verified',
    httpStatus: 400,
    userMessage: 'Your bank account has already been verified.',
  },
  [ErrorCode.BANK_ACCOUNT_INVALID]: {
    message: 'Invalid bank account details',
    httpStatus: 400,
    userMessage: 'The provided bank account details are invalid.',
  },

  // API Quota Errors
  [ErrorCode.API_QUOTA_EXCEEDED]: {
    message: 'API quota exceeded',
    httpStatus: 429,
    userMessage: 'You have exceeded your API quota. Please upgrade your plan or wait for the quota to reset.',
  },
};
