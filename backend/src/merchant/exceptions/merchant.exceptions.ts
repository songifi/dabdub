import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorCodeMetadata } from '../../common/errors/error-codes.enum';

/**
 * Base exception class for merchant-related errors
 */
export class MerchantException extends HttpException {
    constructor(
        public readonly errorCode: ErrorCode,
        public readonly details?: string,
    ) {
        const metadata = ErrorCodeMetadata[errorCode];
        super(
            {
                success: false,
                errorCode,
                message: metadata.userMessage,
                details,
                timestamp: new Date().toISOString(),
            },
            metadata.httpStatus,
        );
    }
}

/**
 * Thrown when a merchant is not found
 */
export class MerchantNotFoundException extends MerchantException {
    constructor(merchantId?: string) {
        super(
            ErrorCode.MERCHANT_NOT_FOUND,
            merchantId ? `Merchant with ID ${merchantId} not found` : undefined,
        );
    }
}

/**
 * Thrown when attempting to create a merchant that already exists
 */
export class MerchantAlreadyExistsException extends MerchantException {
    constructor(email?: string) {
        super(
            ErrorCode.MERCHANT_ALREADY_EXISTS,
            email ? `Merchant with email ${email} already exists` : undefined,
        );
    }
}

/**
 * Thrown when a merchant account is suspended
 */
export class MerchantSuspendedException extends MerchantException {
    constructor(reason?: string) {
        super(
            ErrorCode.MERCHANT_SUSPENDED,
            reason ? `Account suspended: ${reason}` : undefined,
        );
    }
}

/**
 * Thrown when a merchant account is closed
 */
export class MerchantClosedException extends MerchantException {
    constructor() {
        super(ErrorCode.MERCHANT_CLOSED);
    }
}

/**
 * Thrown when a merchant account is inactive
 */
export class MerchantInactiveException extends MerchantException {
    constructor() {
        super(ErrorCode.MERCHANT_INACTIVE);
    }
}

/**
 * Thrown when an invalid status transition is attempted
 */
export class MerchantInvalidStatusException extends MerchantException {
    constructor(currentStatus: string, targetStatus: string) {
        super(
            ErrorCode.MERCHANT_INVALID_STATUS,
            `Cannot transition from ${currentStatus} to ${targetStatus}`,
        );
    }
}

/**
 * Thrown when email is not verified
 */
export class MerchantEmailNotVerifiedException extends MerchantException {
    constructor() {
        super(ErrorCode.MERCHANT_EMAIL_NOT_VERIFIED);
    }
}

/**
 * Thrown when email is already verified
 */
export class MerchantEmailAlreadyVerifiedException extends MerchantException {
    constructor() {
        super(ErrorCode.MERCHANT_EMAIL_ALREADY_VERIFIED);
    }
}

/**
 * Thrown when verification token is invalid
 */
export class MerchantVerificationTokenInvalidException extends MerchantException {
    constructor() {
        super(ErrorCode.MERCHANT_VERIFICATION_TOKEN_INVALID);
    }
}

/**
 * Thrown when verification token has expired
 */
export class MerchantVerificationTokenExpiredException extends MerchantException {
    constructor() {
        super(ErrorCode.MERCHANT_VERIFICATION_TOKEN_EXPIRED);
    }
}

/**
 * Thrown when KYC has not been started
 */
export class KycNotStartedException extends MerchantException {
    constructor() {
        super(ErrorCode.KYC_NOT_STARTED);
    }
}

/**
 * Thrown when KYC has already been submitted
 */
export class KycAlreadySubmittedException extends MerchantException {
    constructor() {
        super(ErrorCode.KYC_ALREADY_SUBMITTED);
    }
}

/**
 * Thrown when KYC has already been approved
 */
export class KycAlreadyApprovedException extends MerchantException {
    constructor() {
        super(ErrorCode.KYC_ALREADY_APPROVED);
    }
}

/**
 * Thrown when KYC documents are required
 */
export class KycDocumentRequiredException extends MerchantException {
    constructor(documentType?: string) {
        super(
            ErrorCode.KYC_DOCUMENT_REQUIRED,
            documentType ? `Required document: ${documentType}` : undefined,
        );
    }
}

/**
 * Thrown when KYC document is invalid
 */
export class KycDocumentInvalidException extends MerchantException {
    constructor(reason?: string) {
        super(
            ErrorCode.KYC_DOCUMENT_INVALID,
            reason,
        );
    }
}

/**
 * Thrown when KYC verification fails
 */
export class KycVerificationFailedException extends MerchantException {
    constructor(reason?: string) {
        super(
            ErrorCode.KYC_VERIFICATION_FAILED,
            reason,
        );
    }
}

/**
 * Thrown when invalid KYC status transition is attempted
 */
export class KycInvalidStatusException extends MerchantException {
    constructor(currentStatus: string, targetStatus: string) {
        super(
            ErrorCode.KYC_STATUS_INVALID,
            `Cannot transition KYC from ${currentStatus} to ${targetStatus}`,
        );
    }
}

/**
 * Thrown when bank account is not found
 */
export class BankAccountNotFoundException extends MerchantException {
    constructor() {
        super(ErrorCode.BANK_ACCOUNT_NOT_FOUND);
    }
}

/**
 * Thrown when bank account verification fails
 */
export class BankAccountVerificationFailedException extends MerchantException {
    constructor(reason?: string) {
        super(
            ErrorCode.BANK_ACCOUNT_VERIFICATION_FAILED,
            reason,
        );
    }
}

/**
 * Thrown when bank account is already verified
 */
export class BankAccountAlreadyVerifiedException extends MerchantException {
    constructor() {
        super(ErrorCode.BANK_ACCOUNT_ALREADY_VERIFIED);
    }
}

/**
 * Thrown when bank account details are invalid
 */
export class BankAccountInvalidException extends MerchantException {
    constructor(reason?: string) {
        super(
            ErrorCode.BANK_ACCOUNT_INVALID,
            reason,
        );
    }
}

/**
 * Thrown when API quota is exceeded
 */
export class ApiQuotaExceededException extends MerchantException {
    constructor(limit?: number, resetAt?: Date) {
        super(
            ErrorCode.API_QUOTA_EXCEEDED,
            resetAt ? `Quota resets at ${resetAt.toISOString()}` : undefined,
        );
    }
}
