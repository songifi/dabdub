import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Reconciliation, ReconciliationStatus, DiscrepancyType } from './reconciliation.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus } from '../transactions/transactions.enums';
import { Settlement, SettlementStatus } from '../settlement/entities/settlement.entity';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private readonly AMOUNT_TOLERANCE = 0.0001;

  constructor(
    @InjectRepository(Reconciliation)
    private readonly reconciliationRepo: Repository<Reconciliation>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
  ) { }

  @Cron(CronExpression.EVERY_HOUR)
  async runAutoReconciliation() {
    this.logger.log('Starting auto reconciliation...');
    try {
      await this.reconcileTransactions();
      await this.reconcileSettlements();
      await this.detectDiscrepancies();
      this.logger.log('Auto reconciliation completed.');
    } catch (error) {
      this.logger.error('Error during auto reconciliation:', error);
    }
  }

  async reconcileTransactions() {
    const confirmedTxs = await this.transactionRepo.find({
      where: { status: TransactionStatus.CONFIRMED },
    });

    for (const tx of confirmedTxs) {
      const existing = await this.reconciliationRepo.findOne({
        where: { transactionId: tx.id },
      });
      if (existing) continue;

      const reconciliation = this.reconciliationRepo.create({
        transactionId: tx.id,
        actualAmount: tx.amount,
        currency: tx.currency,
        status: ReconciliationStatus.PENDING,
        metadata: { txHash: tx.txHash, network: tx.network },
      });

      await this.reconciliationRepo.save(reconciliation);
    }
  }

  async reconcileSettlements() {
    const completedSettlements = await this.settlementRepo.find({
      where: { status: SettlementStatus.COMPLETED },
    });

    for (const settlement of completedSettlements) {
      const existing = await this.reconciliationRepo.findOne({
        where: { settlementId: settlement.id },
      });
      if (existing) continue;

      const variance = Math.abs(
        Number(settlement.amount) - Number(settlement.netAmount),
      );

      const hasDiscrepancy = variance > this.AMOUNT_TOLERANCE;

      const reconciliation = this.reconciliationRepo.create({
        settlementId: settlement.id,
        paymentRequestId: settlement.paymentRequestId,
        expectedAmount: settlement.amount.toString(),
        actualAmount: settlement.netAmount.toString(),
        amountVariance: variance.toString(),
        currency: settlement.currency,
        status: hasDiscrepancy
          ? ReconciliationStatus.DISCREPANCY
          : ReconciliationStatus.MATCHED,
        discrepancyType: hasDiscrepancy
          ? DiscrepancyType.AMOUNT_MISMATCH
          : undefined,
        discrepancyNotes: hasDiscrepancy
          ? `Amount variance of ${variance} detected`
          : undefined,
      });

      await this.reconciliationRepo.save(reconciliation);
    }
  }

  async detectDiscrepancies() {
    const pending = await this.reconciliationRepo.find({
      where: { status: ReconciliationStatus.PENDING },
    });

    for (const record of pending) {
      if (!record.expectedAmount || !record.actualAmount) continue;

      const variance = Math.abs(
        Number(record.expectedAmount) - Number(record.actualAmount),
      );

      if (variance > this.AMOUNT_TOLERANCE) {
        record.status = ReconciliationStatus.DISCREPANCY;
        record.discrepancyType = DiscrepancyType.AMOUNT_MISMATCH;
        record.amountVariance = variance.toString();
        record.discrepancyNotes = `Variance of ${variance} detected`;
      } else {
        record.status = ReconciliationStatus.MATCHED;
      }

      await this.reconciliationRepo.save(record);
    }
  }

  async manualResolve(id: string, resolvedBy: string, notes: string) {
    const record = await this.reconciliationRepo.findOne({ where: { id } });
    if (!record) throw new Error(`Reconciliation ${id} not found`);

    record.status = ReconciliationStatus.MANUALLY_RESOLVED;
    record.resolvedBy = resolvedBy;
    record.resolvedAt = new Date();
    record.discrepancyNotes = notes;

    return this.reconciliationRepo.save(record);
  }

  async getReport() {
    const total = await this.reconciliationRepo.count();
    const matched = await this.reconciliationRepo.count({
      where: { status: ReconciliationStatus.MATCHED },
    });
    const discrepancies = await this.reconciliationRepo.count({
      where: { status: ReconciliationStatus.DISCREPANCY },
    });
    const pending = await this.reconciliationRepo.count({
      where: { status: ReconciliationStatus.PENDING },
    });
    const manuallyResolved = await this.reconciliationRepo.count({
      where: { status: ReconciliationStatus.MANUALLY_RESOLVED },
    });

    return {
      total,
      matched,
      discrepancies,
      pending,
      manuallyResolved,
      autoReconcileRate: total > 0 ? ((matched / total) * 100).toFixed(2) + '%' : '0%',
    };
  }

  async getDiscrepancies() {
    return this.reconciliationRepo.find({
      where: { status: ReconciliationStatus.DISCREPANCY },
      order: { createdAt: 'DESC' },
    });
  }
}
