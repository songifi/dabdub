import { BaseHttpException } from './http-exceptions';
import { ErrorCode } from '../error-codes.enum';

/**
 * Business Logic Exception Base Class
 */
export class BusinessException extends BaseHttpException {
  constructor(
    errorCode: ErrorCode,
    message?: string,
    metadata?: Record<string, any>,
  ) {
    super(errorCode, message, metadata);
  }
}

/**
 * Insufficient Funds Exception
 * Thrown when a user attempts a transaction with insufficient balance
 */
export class InsufficientFundsException extends BusinessException {
  constructor(
    currentBalance?: number,
    requiredAmount?: number,
    metadata?: Record<string, any>,
  ) {
    super(
      ErrorCode.INSUFFICIENT_FUNDS,
      `Insufficient funds. Current balance: ${currentBalance}, Required: ${requiredAmount}`,
      {
        currentBalance,
        requiredAmount,
        ...metadata,
      },
    );
  }
}

/**
 * Wallet Not Found Exception
 */
export class WalletNotFoundException extends BusinessException {
  constructor(walletId?: string, metadata?: Record<string, any>) {
    super(
      ErrorCode.WALLET_NOT_FOUND,
      walletId ? `Wallet with ID ${walletId} not found` : 'Wallet not found',
      {
        walletId,
        ...metadata,
      },
    );
  }
}

/**
 * User Not Found Exception
 */
export class UserNotFoundException extends BusinessException {
  constructor(userId?: string, metadata?: Record<string, any>) {
    super(
      ErrorCode.USER_NOT_FOUND,
      userId ? `User with ID ${userId} not found` : 'User not found',
      {
        userId,
        ...metadata,
      },
    );
  }
}

/**
 * Transaction Not Found Exception
 */
export class TransactionNotFoundException extends BusinessException {
  constructor(transactionId?: string, metadata?: Record<string, any>) {
    super(
      ErrorCode.TRANSACTION_NOT_FOUND,
      transactionId
        ? `Transaction with ID ${transactionId} not found`
        : 'Transaction not found',
      {
        transactionId,
        ...metadata,
      },
    );
  }
}

/**
 * Wallet Locked Exception
 * Thrown when attempting to perform operations on a locked wallet
 */
export class WalletLockedException extends BusinessException {
  constructor(
    walletId?: string,
    reason?: string,
    metadata?: Record<string, any>,
  ) {
    super(ErrorCode.WALLET_LOCKED, reason || 'Wallet is locked', {
      walletId,
      reason,
      ...metadata,
    });
  }
}

/**
 * Transaction Limit Exceeded Exception
 */
export class TransactionLimitExceededException extends BusinessException {
  constructor(
    limit?: number,
    attemptedAmount?: number,
    metadata?: Record<string, any>,
  ) {
    super(
      ErrorCode.TRANSACTION_LIMIT_EXCEEDED,
      `Transaction limit exceeded. Limit: ${limit}, Attempted: ${attemptedAmount}`,
      {
        limit,
        attemptedAmount,
        ...metadata,
      },
    );
  }
}

/**
 * Invalid Transaction State Exception
 */
export class InvalidTransactionStateException extends BusinessException {
  constructor(
    currentState?: string,
    requiredState?: string,
    metadata?: Record<string, any>,
  ) {
    super(
      ErrorCode.INVALID_TRANSACTION_STATE,
      `Invalid transaction state. Current: ${currentState}, Required: ${requiredState}`,
      {
        currentState,
        requiredState,
        ...metadata,
      },
    );
  }
}

/**
 * Operation Not Allowed Exception
 */
export class OperationNotAllowedException extends BusinessException {
  constructor(
    operation?: string,
    reason?: string,
    metadata?: Record<string, any>,
  ) {
    super(
      ErrorCode.OPERATION_NOT_ALLOWED,
      reason || `Operation ${operation} is not allowed`,
      {
        operation,
        reason,
        ...metadata,
      },
    );
  }
}

/**
 * Resource Already Exists Exception
 */
export class ResourceAlreadyExistsException extends BusinessException {
  constructor(
    resourceType?: string,
    identifier?: string,
    metadata?: Record<string, any>,
  ) {
    super(
      ErrorCode.RESOURCE_ALREADY_EXISTS,
      `${resourceType || 'Resource'} with identifier ${identifier} already exists`,
      {
        resourceType,
        identifier,
        ...metadata,
      },
    );
  }
}
