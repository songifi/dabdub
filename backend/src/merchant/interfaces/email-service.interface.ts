/**
 * Interface for email service operations
 * Allows for dependency injection and mocking in tests
 */
export interface IEmailService {
    /**
     * Send email verification email
     */
    sendVerificationEmail(email: string, token: string, name: string): Promise<void>;

    /**
     * Send welcome email after registration
     */
    sendWelcomeEmail(email: string, name: string): Promise<void>;

    /**
     * Send KYC submission confirmation
     */
    sendKycSubmittedEmail(email: string, name: string): Promise<void>;

    /**
     * Send KYC approval notification
     */
    sendKycApprovedEmail(email: string, name: string): Promise<void>;

    /**
     * Send KYC rejection notification
     */
    sendKycRejectedEmail(email: string, name: string, reason: string): Promise<void>;

    /**
     * Send account suspension notification
     */
    sendAccountSuspendedEmail(email: string, name: string, reason?: string): Promise<void>;

    /**
     * Send account reactivation notification
     */
    sendAccountReactivatedEmail(email: string, name: string): Promise<void>;

    /**
     * Send bank account verified notification
     */
    sendBankAccountVerifiedEmail(email: string, name: string): Promise<void>;

    /**
     * Send password reset email
     */
    sendPasswordResetEmail(email: string, token: string, name: string): Promise<void>;
}

/**
 * Interface for bank verification service
 */
export interface IBankVerificationService {
    /**
     * Verify bank account details
     */
    verifyBankAccount(
        accountNumber: string,
        routingNumber: string,
        accountHolderName: string,
    ): Promise<{ success: boolean; error?: string }>;

    /**
     * Initiate micro-deposit verification
     */
    initiateMicroDeposits(
        accountNumber: string,
        routingNumber: string,
    ): Promise<{ success: boolean; verificationId?: string; error?: string }>;

    /**
     * Confirm micro-deposit amounts
     */
    confirmMicroDeposits(
        verificationId: string,
        amounts: number[],
    ): Promise<{ success: boolean; error?: string }>;
}

/**
 * Interface for KYC verification service
 */
export interface IKycVerificationService {
    /**
     * Submit documents for verification
     */
    submitDocuments(
        merchantId: string,
        documents: Array<{ type: string; fileUrl: string }>,
    ): Promise<{ success: boolean; verificationId?: string; error?: string }>;

    /**
     * Check verification status
     */
    checkVerificationStatus(
        verificationId: string,
    ): Promise<{ status: 'pending' | 'approved' | 'rejected'; reason?: string }>;

    /**
     * Validate document format and content
     */
    validateDocument(
        documentType: string,
        fileUrl: string,
    ): Promise<{ valid: boolean; error?: string }>;
}
