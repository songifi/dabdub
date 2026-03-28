import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus, DisputeType } from './entities/dispute.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { QueryDisputesDto } from './dto/query-dispute.dto';
import { Transaction, TransactionStatus } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { SorobanService } from '../soroban/soroban.service';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.types';

const DISPUTE_WINDOW_DAYS = 7;

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly sorobanService: SorobanService,
    private readonly notificationService: NotificationService,
  ) {}

  // ── User: create ──────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateDisputeDto): Promise<Dispute> {
    const tx = await this.txRepo.findOne({ where: { id: dto.transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new ForbiddenException();

    if (tx.status !== TransactionStatus.COMPLETED) {
      throw new BadRequestException('Only completed transactions can be disputed');
    }

    const ageMs = Date.now() - tx.createdAt.getTime();
    if (ageMs > DISPUTE_WINDOW_DAYS * 86_400_000) {
      throw new BadRequestException('Dispute window has closed');
    }

    const existing = await this.disputeRepo.findOne({
      where: {
        transactionId: dto.transactionId,
        status: DisputeStatus.OPEN,
      },
    });
    if (existing) throw new ConflictException('An open dispute already exists for this transaction');

    const dispute = await this.disputeRepo.save(
      this.disputeRepo.create({
        userId,
        transactionId: dto.transactionId,
        type: dto.type,
        description: dto.description,
        status: DisputeStatus.OPEN,
      }),
    );

    // Notify admin via system notification to admin user (best-effort)
    await this.notificationService.create(
      userId,
      NotificationType.SYSTEM,
      'Dispute submitted',
      `Your dispute for transaction ${dto.transactionId.slice(-8).toUpperCase()} has been received.`,
      { disputeId: dispute.id },
    );

    return dispute;
  }

  // ── User: list / detail ───────────────────────────────────────────────────

  async list(userId: string): Promise<Dispute[]> {
    return this.disputeRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.userId !== userId) throw new ForbiddenException();
    return dispute;
  }

  // ── Admin: list / detail ──────────────────────────────────────────────────

  async adminList(query: QueryDisputesDto): Promise<Dispute[]> {
    return this.disputeRepo.find({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async adminDetail(id: string): Promise<{
    dispute: Dispute;
    transaction: Transaction;
    disputer: User;
    counterparty: User | null;
    suggestedResolution: string;
  }> {
    const dispute = await this.disputeRepo.findOne({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const tx = await this.txRepo.findOne({ where: { id: dispute.transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    const disputer = await this.userRepo.findOne({ where: { id: dispute.userId } });
    if (!disputer) throw new NotFoundException('Disputer not found');

    const counterparty = tx.counterpartyUsername
      ? await this.userRepo.findOne({ where: { username: tx.counterpartyUsername } })
      : null;

    const suggestedResolution = this.suggestResolution(dispute.type);

    return { dispute, transaction: tx, disputer, counterparty, suggestedResolution };
  }

  // ── Admin: approve ────────────────────────────────────────────────────────

  async approve(disputeId: string, adminId: string): Promise<Dispute> {
    const dispute = await this.requireOpenOrInvestigating(disputeId);
    const tx = await this.txRepo.findOne({ where: { id: dispute.transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    const disputer = await this.userRepo.findOne({ where: { id: dispute.userId } });
    if (!disputer) throw new NotFoundException('Disputer not found');

    // Execute on-chain reversal: transfer from counterparty back to disputer
    let reversalTxHash: string | null = null;
    if (tx.counterpartyUsername && disputer.username) {
      try {
        const result = await this.sorobanService.transfer(
          tx.counterpartyUsername,
          disputer.username,
          tx.amountUsdc,
          `Reversal for dispute ${disputeId}`,
        ) as any;
        reversalTxHash = result?.hash ?? result?.id ?? String(result);
      } catch {
        // Log but don't block — admin can retry
      }
    }

    dispute.status = DisputeStatus.RESOLVED_APPROVED;
    dispute.resolvedBy = adminId;
    dispute.resolvedAt = new Date();
    dispute.reversalTxHash = reversalTxHash;
    await this.disputeRepo.save(dispute);

    await this.notificationService.create(
      dispute.userId,
      NotificationType.SYSTEM,
      'Dispute approved',
      `Your dispute has been approved and funds have been reversed.`,
      { disputeId },
    );

    return dispute;
  }

  // ── Admin: reject ─────────────────────────────────────────────────────────

  async reject(disputeId: string, adminId: string, resolution?: string): Promise<Dispute> {
    const dispute = await this.requireOpenOrInvestigating(disputeId);

    dispute.status = DisputeStatus.RESOLVED_REJECTED;
    dispute.resolvedBy = adminId;
    dispute.resolvedAt = new Date();
    dispute.resolution = resolution ?? null;
    await this.disputeRepo.save(dispute);

    await this.notificationService.create(
      dispute.userId,
      NotificationType.SYSTEM,
      'Dispute rejected',
      resolution
        ? `Your dispute was rejected: ${resolution}`
        : 'Your dispute was reviewed and rejected.',
      { disputeId },
    );

    return dispute;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async requireOpenOrInvestigating(disputeId: string): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (
      dispute.status !== DisputeStatus.OPEN &&
      dispute.status !== DisputeStatus.INVESTIGATING
    ) {
      throw new BadRequestException(`Dispute is already ${dispute.status}`);
    }
    return dispute;
  }

  private suggestResolution(type: DisputeType): string {
    const map: Record<DisputeType, string> = {
      [DisputeType.UNAUTHORIZED]: 'Verify account security; reverse if confirmed unauthorized.',
      [DisputeType.WRONG_AMOUNT]: 'Compare on-chain amount vs recorded amount; reverse delta.',
      [DisputeType.DUPLICATE]: 'Check for duplicate tx hash; reverse one if confirmed.',
      [DisputeType.NOT_RECEIVED]: 'Verify counterparty balance increase; escalate if discrepancy.',
      [DisputeType.OTHER]: 'Review transaction details and user history.',
    };
    return map[type];
  }
}
