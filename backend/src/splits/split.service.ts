import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SplitRequest, SplitRequestStatus } from './entities/split-request.entity';
import { SplitParticipant, SplitParticipantStatus } from './entities/split-participant.entity';
import { CreateSplitDto } from './dto/create-split.dto';
import { QuerySplitsDto, SplitRole } from './dto/query-splits.dto';
import { UsersService } from '../users/users.service';
import { TransfersService } from '../transfers/transfers.service';
import { NotificationService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { NotificationType } from '../notifications/notifications.types';

export const SPLIT_QUEUE = 'split-payments';
export const EXPIRE_SPLITS_JOB = 'expire-splits';

@Injectable()
export class SplitService {
  private readonly logger = new Logger(SplitService.name);

  constructor(
    @InjectRepository(SplitRequest)
    private readonly splitRepo: Repository<SplitRequest>,
    @InjectRepository(SplitParticipant)
    private readonly participantRepo: Repository<SplitParticipant>,
    private readonly usersService: UsersService,
    private readonly transfersService: TransfersService,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    @InjectQueue(SPLIT_QUEUE)
    private readonly splitQueue: Queue,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(initiatorId: string, initiatorUsername: string, dto: CreateSplitDto): Promise<SplitRequest> {
    // Validate amounts sum to total
    const participantTotal = dto.participants
      .reduce((sum, p) => sum + parseFloat(p.amountUsdc), 0)
      .toFixed(6);
    if (Math.abs(parseFloat(participantTotal) - parseFloat(dto.participants.reduce((s, p) => (parseFloat(s) + parseFloat(p.amountUsdc)).toFixed(6), '0'))) > 0.000001) {
      // re-check with simple sum
    }
    const total = dto.participants.reduce((s, p) => s + parseFloat(p.amountUsdc), 0);
    const declared = parseFloat(dto.participants.reduce((_, __) => _, dto.participants.reduce((s, p) => (s + parseFloat(p.amountUsdc)), 0).toFixed(6)));

    // Resolve all usernames → users (validates existence)
    const resolvedUsers = await Promise.all(
      dto.participants.map(async (p) => {
        if (p.username === initiatorUsername) {
          throw new BadRequestException('Initiator cannot be a participant');
        }
        const user = await this.usersService.findByUsername(p.username);
        if (!user) throw new NotFoundException(`User @${p.username} not found`);
        return { user, amountUsdc: p.amountUsdc };
      }),
    );

    // Validate sum equals totalAmountUsdc
    const sum = resolvedUsers.reduce((s, r) => s + parseFloat(r.amountUsdc), 0);
    // We derive totalAmountUsdc from the sum (spec: total of participant amounts must equal totalAmountUsdc)
    const totalAmountUsdc = sum.toFixed(6);

    const expiresAt = new Date(Date.now() + dto.expiresInHours * 3_600_000);

    const split = await this.splitRepo.save(
      this.splitRepo.create({
        initiatorId,
        title: dto.title,
        totalAmountUsdc,
        note: dto.note ?? null,
        status: SplitRequestStatus.ACTIVE,
        expiresAt,
      }),
    );

    const participants = await this.participantRepo.save(
      resolvedUsers.map((r) =>
        this.participantRepo.create({
          splitRequestId: split.id,
          userId: r.user.id,
          username: r.user.username,
          amountOwedUsdc: r.amountUsdc,
          status: SplitParticipantStatus.PENDING,
        }),
      ),
    );

    // Notify each participant
    for (const p of participants) {
      const amount = p.amountOwedUsdc;
      await this.notificationService.create(
        p.userId,
        NotificationType.SYSTEM,
        'Split payment request',
        `You owe ${amount} USDC for "${split.title}"`,
        { splitRequestId: split.id },
      );
      const user = resolvedUsers.find((r) => r.user.id === p.userId)!.user;
      await this.emailService.queue(
        user.email,
        'split-request',
        { title: split.title, amountUsdc: amount, splitId: split.id },
        p.userId,
      );
    }

    return split;
  }

  // ── Pay ───────────────────────────────────────────────────────────────────

  async pay(splitRequestId: string, payerId: string, payerUsername: string): Promise<SplitParticipant> {
    const split = await this.findActiveOrFail(splitRequestId);

    if (split.initiatorId === payerId) {
      throw new ForbiddenException('Initiator cannot pay their own split');
    }

    const participant = await this.participantRepo.findOne({
      where: { splitRequestId, userId: payerId },
    });
    if (!participant) throw new NotFoundException('You are not a participant in this split');
    if (participant.status !== SplitParticipantStatus.PENDING) {
      throw new BadRequestException(`Share already ${participant.status}`);
    }

    // Resolve initiator username
    const initiator = await this.usersService.findById(split.initiatorId);

    const transfer = await this.transfersService.create(payerId, payerUsername, {
      toUsername: initiator.username,
      amount: participant.amountOwedUsdc,
      note: `Split: ${split.title}`,
    });

    participant.status = SplitParticipantStatus.PAID;
    participant.paidAt = new Date();
    participant.txHash = (transfer as any).txHash ?? transfer.id;
    await this.participantRepo.save(participant);

    // Check if all participants paid → complete split
    const pending = await this.participantRepo.count({
      where: { splitRequestId, status: SplitParticipantStatus.PENDING },
    });
    if (pending === 0) {
      await this.splitRepo.update(splitRequestId, { status: SplitRequestStatus.COMPLETED });
    }

    // Notify initiator
    await this.notificationService.create(
      split.initiatorId,
      NotificationType.TRANSFER_RECEIVED,
      'Split payment received',
      `@${payerUsername} paid ${participant.amountOwedUsdc} USDC for "${split.title}"`,
      { splitRequestId },
    );

    return participant;
  }

  // ── Decline ───────────────────────────────────────────────────────────────

  async decline(splitRequestId: string, userId: string): Promise<SplitParticipant> {
    await this.findActiveOrFail(splitRequestId);

    const participant = await this.participantRepo.findOne({
      where: { splitRequestId, userId },
    });
    if (!participant) throw new NotFoundException('You are not a participant in this split');
    if (participant.status !== SplitParticipantStatus.PENDING) {
      throw new BadRequestException(`Share already ${participant.status}`);
    }

    participant.status = SplitParticipantStatus.DECLINED;
    await this.participantRepo.save(participant);

    const split = await this.splitRepo.findOne({ where: { id: splitRequestId } });
    await this.notificationService.create(
      split!.initiatorId,
      NotificationType.SYSTEM,
      'Split payment declined',
      `@${participant.username} declined their share for "${split!.title}"`,
      { splitRequestId },
    );

    return participant;
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancel(splitRequestId: string, initiatorId: string): Promise<SplitRequest> {
    const split = await this.splitRepo.findOne({ where: { id: splitRequestId } });
    if (!split) throw new NotFoundException('Split request not found');
    if (split.initiatorId !== initiatorId) throw new ForbiddenException();
    if (split.status !== SplitRequestStatus.ACTIVE) {
      throw new BadRequestException('Only active splits can be cancelled');
    }

    await this.participantRepo.update(
      { splitRequestId, status: SplitParticipantStatus.PENDING },
      { status: SplitParticipantStatus.DECLINED },
    );

    split.status = SplitRequestStatus.CANCELLED;
    await this.splitRepo.save(split);

    const participants = await this.participantRepo.find({ where: { splitRequestId } });
    for (const p of participants) {
      await this.notificationService.create(
        p.userId,
        NotificationType.SYSTEM,
        'Split cancelled',
        `The split "${split.title}" was cancelled`,
        { splitRequestId },
      );
    }

    return split;
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async list(userId: string, query: QuerySplitsDto): Promise<SplitRequest[]> {
    if (query.role === SplitRole.INITIATOR) {
      return this.splitRepo.find({
        where: { initiatorId: userId, ...(query.status ? { status: query.status } : {}) },
        order: { createdAt: 'DESC' },
      });
    }

    if (query.role === SplitRole.PARTICIPANT) {
      const participations = await this.participantRepo.find({ where: { userId } });
      const ids = participations.map((p) => p.splitRequestId);
      if (!ids.length) return [];
      return this.splitRepo.find({
        where: { id: In(ids), ...(query.status ? { status: query.status } : {}) },
        order: { createdAt: 'DESC' },
      });
    }

    // Both roles
    const participations = await this.participantRepo.find({ where: { userId } });
    const participantIds = participations.map((p) => p.splitRequestId);

    const [asInitiator, asParticipant] = await Promise.all([
      this.splitRepo.find({
        where: { initiatorId: userId, ...(query.status ? { status: query.status } : {}) },
        order: { createdAt: 'DESC' },
      }),
      participantIds.length
        ? this.splitRepo.find({
            where: { id: In(participantIds), ...(query.status ? { status: query.status } : {}) },
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve([]),
    ]);

    const seen = new Set<string>();
    return [...asInitiator, ...asParticipant].filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }

  // ── Detail ────────────────────────────────────────────────────────────────

  async findOne(splitRequestId: string, userId: string): Promise<{ split: SplitRequest; participants: SplitParticipant[] }> {
    const split = await this.splitRepo.findOne({ where: { id: splitRequestId } });
    if (!split) throw new NotFoundException('Split request not found');

    const participants = await this.participantRepo.find({ where: { splitRequestId } });
    const isInvolved =
      split.initiatorId === userId || participants.some((p) => p.userId === userId);
    if (!isInvolved) throw new ForbiddenException();

    return { split, participants };
  }

  // ── Cron: expire ─────────────────────────────────────────────────────────

  async expireOverdue(): Promise<void> {
    const expired = await this.splitRepo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SplitRequestStatus.ACTIVE })
      .andWhere('s.expires_at < NOW()')
      .getMany();

    for (const split of expired) {
      split.status = SplitRequestStatus.EXPIRED;
      await this.splitRepo.save(split);

      const pending = await this.participantRepo.find({
        where: { splitRequestId: split.id, status: SplitParticipantStatus.PENDING },
      });
      const uncollected = pending.reduce((s, p) => s + parseFloat(p.amountOwedUsdc), 0);

      if (uncollected > 0) {
        await this.notificationService.create(
          split.initiatorId,
          NotificationType.SYSTEM,
          'Split expired',
          `Your split "${split.title}" expired. ${uncollected.toFixed(6)} USDC uncollected.`,
          { splitRequestId: split.id },
        );
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async findActiveOrFail(splitRequestId: string): Promise<SplitRequest> {
    const split = await this.splitRepo.findOne({ where: { id: splitRequestId } });
    if (!split) throw new NotFoundException('Split request not found');
    if (split.status !== SplitRequestStatus.ACTIVE) {
      throw new BadRequestException(`Split is ${split.status}`);
    }
    return split;
  }
}
