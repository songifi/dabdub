import { Injectable, Logger } from '@nestjs/common';
import { IPartnerService, TransferResult } from '../interfaces/partner-service.interface';

@Injectable()
export class MockPartnerService implements IPartnerService {
    private readonly logger = new Logger(MockPartnerService.name);

    async executeTransfer(
        amount: number,
        currency: string,
        recipient: { accountNumber: string; routingNumber: string; name: string },
    ): Promise<TransferResult> {
        this.logger.log(
            `Executing transfer of ${amount} ${currency} to ${recipient.name} (${recipient.accountNumber})`,
        );

        // Simulate API latency
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Simulate random failure (10% chance)
        if (Math.random() < 0.1) {
            return {
                success: false,
                error: 'Random simulator failure',
            };
        }

        return {
            success: true,
            transactionId: `mock_tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        };
    }

    async getExchangeRate(from: string, to: string): Promise<number> {
        // specific mock rates
        const rates: Record<string, number> = {
            'USDC-USD': 1.0,
            'BTC-USD': 50000.0,
            'ETH-USD': 3000.0,
        };

        const key = `${from}-${to}`;
        return rates[key] || 0.0;
    }
}
