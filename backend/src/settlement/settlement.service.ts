import { Inject, Injectable, Logger } from '@nestjs/common';
import { SettlementRepository } from './repositories/settlement.repository';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Settlement, SettlementStatus, SettlementProvider } from './entities/settlement.entity';
import { IPartnerService } from './interfaces/partner-service.interface';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@Injectable()
export class SettlementService {
    private readonly logger = new Logger(SettlementService.name);

    constructor(
        private readonly settlementRepository: SettlementRepository,
        @Inject('IPartnerService')
        private readonly partnerService: IPartnerService,
    ) { }

    /**
     * Create a new settlement request
     */
    async createSettlement(data: CreateSettlementDto): Promise<Settlement> {
        const exchangeRate = await this.partnerService.getExchangeRate(
            data.sourceCurrency,
            data.currency,
        );

        const feePercentage = 0.01; // 1% fee
        const feeAmount = data.amount * feePercentage;
        const netAmount = data.amount - feeAmount;

        return this.settlementRepository.create({
            paymentRequestId: data.paymentRequestId,
            merchantId: data.merchantId,
            amount: data.amount,
            currency: data.currency,
            sourceCurrency: data.sourceCurrency,
            exchangeRate,
            feeAmount,
            feePercentage,
            netAmount,
            bankAccountNumber: data.bankDetails.accountNumber,
            bankRoutingNumber: data.bankDetails.routingNumber,
            bankAccountHolderName: data.bankDetails.name,
            bankName: data.bankDetails.bankName,
            status: SettlementStatus.PENDING,
            provider: SettlementProvider.BANK_API, // Default to generic bank API
        });
    }

    /**
     * Cron job to process pending settlements
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async processSettlements() {
        this.logger.log('Starting settlement batch processing...');

        const pendingSettlements = await this.settlementRepository.findPendingSettlements(50);

        if (pendingSettlements.length === 0) {
            this.logger.log('No pending settlements found.');
            return;
        }

        this.logger.log(`Found ${pendingSettlements.length} pending settlements.`);

        // Mark all as processing first
        const settlementIds = pendingSettlements.map((s) => s.id);
        await this.settlementRepository.updateBatch(
            settlementIds,
            {
                status: SettlementStatus.PROCESSING,
                processedAt: new Date()
            }
        );

        for (const settlement of pendingSettlements) {
            await this.processSingleSettlement(settlement);
        }

        this.logger.log('Batch processing completed.');
    }

    private async processSingleSettlement(settlement: Settlement) {
        try {
            const result = await this.partnerService.executeTransfer(
                settlement.netAmount,
                settlement.currency,
                {
                    accountNumber: settlement.bankAccountNumber,
                    routingNumber: settlement.bankRoutingNumber,
                    name: settlement.bankAccountHolderName,
                },
            );

            if (result.success) {
                await this.settlementRepository.updateStatus(
                    settlement.id,
                    SettlementStatus.COMPLETED,
                    {
                        settlementReference: result.transactionId,
                        settlementReceipt: `RCPT-${result.transactionId}`,
                        providerReference: result.transactionId,
                    },
                );
                this.logger.log(`Settlement ${settlement.id} completed successfully.`);
            } else {
                await this.handleSettlementFailure(settlement, result.error || 'Unknown error');
            }
        } catch (error) {
            this.logger.error(`Error processing settlement ${settlement.id}:`, error);
            await this.handleSettlementFailure(settlement, (error as any).message);
        }
    }

    private async handleSettlementFailure(settlement: Settlement, reason: string) {
        const newRetryCount = settlement.retryCount + 1;
        const status =
            newRetryCount >= settlement.maxRetries
                ? SettlementStatus.FAILED
                : SettlementStatus.PENDING; // Set back to pending for retry in next batch

        await this.settlementRepository.update(
            settlement.id,
            {
                status,
                retryCount: newRetryCount,
                failureReason: reason,
            }
        );

        this.logger.warn(
            `Settlement ${settlement.id} failed (Attempt ${newRetryCount}/${settlement.maxRetries}). Reason: ${reason}. New Status: ${status}`,
        );
    }
}
