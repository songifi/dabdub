import { Injectable, Logger } from '@nestjs/common';
import { IBankVerificationService } from '../interfaces/email-service.interface';

/**
 * Mock implementation of bank verification service for development/testing
 */
@Injectable()
export class MockBankVerificationService implements IBankVerificationService {
    private readonly logger = new Logger(MockBankVerificationService.name);

    async verifyBankAccount(
        accountNumber: string,
        routingNumber: string,
        accountHolderName: string,
    ): Promise<{ success: boolean; error?: string }> {
        this.logger.log(`[MOCK] Verifying bank account: ${accountNumber.slice(-4)}`);

        // Simulate verification delay
        await this.simulateDelay(500);

        // Mock validation logic
        // In production, this would call actual bank verification APIs
        if (accountNumber.startsWith('0000')) {
            return { success: false, error: 'Invalid account number' };
        }

        if (routingNumber === '000000000') {
            return { success: false, error: 'Invalid routing number' };
        }

        this.logger.log(`[MOCK] Bank account verified successfully`);
        return { success: true };
    }

    async initiateMicroDeposits(
        accountNumber: string,
        routingNumber: string,
    ): Promise<{ success: boolean; verificationId?: string; error?: string }> {
        this.logger.log(`[MOCK] Initiating micro-deposits for account: ${accountNumber.slice(-4)}`);

        await this.simulateDelay(300);

        const verificationId = `verify_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        this.logger.log(`[MOCK] Micro-deposits initiated. Verification ID: ${verificationId}`);
        return { success: true, verificationId };
    }

    async confirmMicroDeposits(
        verificationId: string,
        amounts: number[],
    ): Promise<{ success: boolean; error?: string }> {
        this.logger.log(`[MOCK] Confirming micro-deposits for verification: ${verificationId}`);

        await this.simulateDelay(200);

        // Mock validation - accept if amounts are between 0.01 and 0.99
        const validAmounts = amounts.every(amount => amount >= 0.01 && amount <= 0.99);

        if (!validAmounts) {
            return { success: false, error: 'Incorrect micro-deposit amounts' };
        }

        this.logger.log(`[MOCK] Micro-deposits confirmed successfully`);
        return { success: true };
    }

    private simulateDelay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
