import { Injectable, Logger } from '@nestjs/common';
import { IEmailService } from '../interfaces/email-service.interface';

/**
 * Mock implementation of email service for development/testing
 */
@Injectable()
export class MockEmailService implements IEmailService {
    private readonly logger = new Logger(MockEmailService.name);

    async sendVerificationEmail(email: string, token: string, name: string): Promise<void> {
        this.logger.log(`[MOCK] Sending verification email to ${email}`);
        this.logger.debug(`Verification token: ${token}`);
        // In production, this would send an actual email
    }

    async sendWelcomeEmail(email: string, name: string): Promise<void> {
        this.logger.log(`[MOCK] Sending welcome email to ${email} for ${name}`);
    }

    async sendKycSubmittedEmail(email: string, name: string): Promise<void> {
        this.logger.log(`[MOCK] Sending KYC submitted confirmation to ${email}`);
    }

    async sendKycApprovedEmail(email: string, name: string): Promise<void> {
        this.logger.log(`[MOCK] Sending KYC approved notification to ${email}`);
    }

    async sendKycRejectedEmail(email: string, name: string, reason: string): Promise<void> {
        this.logger.log(`[MOCK] Sending KYC rejected notification to ${email}. Reason: ${reason}`);
    }

    async sendAccountSuspendedEmail(email: string, name: string, reason?: string): Promise<void> {
        this.logger.log(`[MOCK] Sending account suspended notification to ${email}. Reason: ${reason || 'N/A'}`);
    }

    async sendAccountReactivatedEmail(email: string, name: string): Promise<void> {
        this.logger.log(`[MOCK] Sending account reactivated notification to ${email}`);
    }

    async sendBankAccountVerifiedEmail(email: string, name: string): Promise<void> {
        this.logger.log(`[MOCK] Sending bank account verified notification to ${email}`);
    }

    async sendPasswordResetEmail(email: string, token: string, name: string): Promise<void> {
        this.logger.log(`[MOCK] Sending password reset email to ${email}`);
        this.logger.debug(`Reset token: ${token}`);
    }
}
