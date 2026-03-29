import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GroupExpense, GroupExpenseSplitType, GroupExpenseStatus } from './entities/group-expense.entity';
import { ExpenseSplit } from './entities/expense-split.entity';
import { GroupsRepository } from '../groups/groups.repository';
import { UsersService } from '../users/users.service';
import { TransfersService } from '../transfers/transfers.service';
import { CheeseGateway, WS_EVENTS } from '../ws/cheese.gateway';
import { CreateGroupExpenseDto } from './dto/create-group-expense.dto';
import { UpdateSplitsDto } from './dto/update-splits.dto';

@Injectable()
export class GroupExpensesService {
  private readonly logger = new Logger(GroupExpensesService.name);

  constructor(
    @InjectRepository(GroupExpense)
    private readonly expenseRepo: Repository<GroupExpense>,
    @InjectRepository(ExpenseSplit)
    private readonly splitRepo: Repository<ExpenseSplit>,
    private readonly groupsRepository: GroupsRepository,
    private readonly usersService: UsersService,
    private readonly transfersService: TransfersService,
    private readonly gateway: CheeseGateway,
  ) {}

  private ensureDecimal(value: number): string {
    return value.toFixed(6);
  }

  private toNumber(value: string): number {
    return parseFloat(value);
  }

  private async assertGroupMember(groupId: string, userId: string): Promise<void> {
    const isMember = await this.groupsRepository.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this group');
    }
  }

  async createExpense(creatorId: string, dto: CreateGroupExpenseDto, groupId: string): Promise<GroupExpense> {
    const group = await this.groupsRepository.findByIdWithMembers(groupId);
    if (!group) throw new NotFoundException('Group not found');
    if (!group.members.some((m) => m.userId === creatorId)) {
      throw new ForbiddenException('Creator must be in the group');
    }

    const participantIds = dto.participantIds && dto.participantIds.length > 0
      ? Array.from(new Set(dto.participantIds))
      : group.members.map((m) => m.userId);

    if (!participantIds.includes(creatorId)) participantIds.push(creatorId);

    const total = this.toNumber(dto.totalAmount);
    if (isNaN(total) || total <= 0) {
      throw new BadRequestException('Invalid total amount');
    }

    let splits: { userId: string; amountOwed: string }[] = [];

    if (dto.splitType === GroupExpenseSplitType.EQUAL) {
      const count = participantIds.length;
      const base = parseFloat((total / count).toFixed(6));
      const totalAssigned = parseFloat((base * count).toFixed(6));
      const remainder = parseFloat((total - totalAssigned).toFixed(6));

      splits = participantIds.map((userId) => ({
        userId,
        amountOwed: this.ensureDecimal(base),
      }));

      if (remainder !== 0) {
        const creatorSplit = splits.find((s) => s.userId === creatorId);
        creatorSplit.amountOwed = this.ensureDecimal(this.toNumber(creatorSplit.amountOwed) + remainder);
      }
    } else if (dto.splitType === GroupExpenseSplitType.CUSTOM) {
      if (!dto.splits || dto.splits.length === 0) {
        throw new BadRequestException('Custom splits must be provided');
      }

      const provided = dto.splits.map((part) => ({ userId: part.userId, amountOwed: part.amountOwed }));
      if (provided.some((p) => !p.userId || p.amountOwed == null)) {
        throw new BadRequestException('Each split must have userId and amountOwed');
      }

      const declaredTotal = provided.reduce((s, p) => s + this.toNumber(p.amountOwed), 0);
      if (Math.abs(declaredTotal - total) > 0.000001) {
        throw new BadRequestException('Custom split amounts must sum to total amount');
      }

      splits = provided.map((p) => ({ userId: p.userId, amountOwed: this.ensureDecimal(this.toNumber(p.amountOwed)) }));
    } else if (dto.splitType === GroupExpenseSplitType.PERCENTAGE) {
      if (!dto.splits || dto.splits.length === 0) {
        throw new BadRequestException('Percentage splits must be provided');
      }
      const sumPercent = dto.splits.reduce((s, p) => s + (p.percentage ?? 0), 0);
      if (Math.abs(sumPercent - 100) > 0.0001) {
        throw new BadRequestException('Percentage splits must sum to 100');
      }

      splits = dto.splits.map((p) => ({
        userId: p.userId,
        amountOwed: this.ensureDecimal((total * (p.percentage ?? 0)) / 100),
      }));

      const assigned = splits.reduce((s, p) => s + this.toNumber(p.amountOwed), 0);
      const remainder = parseFloat((total - assigned).toFixed(6));
      if (Math.abs(remainder) > 0) {
        const creatorSplit = splits.find((s) => s.userId === creatorId);
        if (creatorSplit) {
          creatorSplit.amountOwed = this.ensureDecimal(this.toNumber(creatorSplit.amountOwed) + remainder);
        }
      }
    } else {
      throw new BadRequestException('Unsupported split type');
    }

    const unverifiedIds = splits.map((s) => s.userId).filter((uid) => !group.members.find((m) => m.userId === uid));
    if (unverifiedIds.length > 0) {
      throw new BadRequestException('All participants must be group members');
    }

    const expense = this.expenseRepo.create({
      groupId,
      conversationId: dto.conversationId,
      createdBy: creatorId,
      title: dto.title,
      totalAmount: this.ensureDecimal(total),
      tokenId: dto.tokenId,
      splitType: dto.splitType,
      status: GroupExpenseStatus.OPEN,
    });

    const savedExpense = await this.expenseRepo.save(expense);

    const splitEntities = await this.splitRepo.save(
      splits.map((split) => {
        const isCreator = split.userId === creatorId;
        return this.splitRepo.create({
          expenseId: savedExpense.id,
          userId: split.userId,
          amountOwed: split.amountOwed,
          amountPaid: isCreator ? this.ensureDecimal(total) : '0',
          isPaid: isCreator,
          paidAt: isCreator ? new Date() : null,
        });
      }),
    );

    const status = splitEntities.every((s) => s.isPaid)
      ? GroupExpenseStatus.SETTLED
      : GroupExpenseStatus.OPEN;

    await this.expenseRepo.update(savedExpense.id, { status });
    savedExpense.status = status;

    await Promise.all(
      group.members.map((member) =>
        this.gateway.emitToUser(member.userId, WS_EVENTS.EXPENSE_NEW, {
          expense: savedExpense,
          splits: splitEntities,
        }),
      ),
    );

    return savedExpense;
  }

  async updateSplits(userId: string, expenseId: string, dto: UpdateSplitsDto): Promise<ExpenseSplit[]> {
    const expense = await this.expenseRepo.findOne({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.createdBy !== userId) throw new ForbiddenException('Only creator can update splits');

    const allSplits = await this.splitRepo.find({ where: { expenseId } });
    const adjustments = dto.splits.reduce((acc, s) => {
      acc[s.userId] = s;
      return acc;
    }, {} as Record<string, any>);

    const updatedSplits = allSplits.map((split) => {
      const provided = adjustments[split.userId];
      if (provided && provided.amountOwed) {
        split.amountOwed = this.ensureDecimal(this.toNumber(provided.amountOwed));
      }
      split.isPaid = split.userId === expense.createdBy ? true : false;
      split.amountPaid = split.userId === expense.createdBy ? expense.totalAmount : '0';
      split.paidAt = split.userId === expense.createdBy ? new Date() : null;
      return split;
    });

    const sum = updatedSplits.reduce((s, sp) => s + this.toNumber(sp.amountOwed), 0);
    if (Math.abs(sum - this.toNumber(expense.totalAmount)) > 0.000001) {
      throw new BadRequestException('Updated split amounts must sum to total amount');
    }

    await this.splitRepo.save(updatedSplits);

    expense.status = GroupExpenseStatus.OPEN;
    await this.expenseRepo.save(expense);

    return updatedSplits;
  }

  async markPaid(expenseId: string, userId: string): Promise<ExpenseSplit> {
    const expense = await this.expenseRepo.findOne({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException('Expense not found');

    const split = await this.splitRepo.findOne({ where: { expenseId, userId } });
    if (!split) throw new NotFoundException('Split line not found');
    if (split.isPaid) throw new BadRequestException('Split already marked paid');

    split.isPaid = true;
    split.amountPaid = split.amountOwed;
    split.paidAt = new Date();

    await this.splitRepo.save(split);

    const remaining = await this.splitRepo.count({ where: { expenseId, isPaid: false } });
    expense.status = remaining === 0 ? GroupExpenseStatus.SETTLED : GroupExpenseStatus.PARTIALLY_SETTLED;
    await this.expenseRepo.save(expense);

    if (expense.status === GroupExpenseStatus.SETTLED) {
      const group = await this.groupsRepository.findByIdWithMembers(expense.groupId);
      if (group) {
        await Promise.all(
          group.members.map((member) =>
            this.gateway.emitToUser(member.userId, WS_EVENTS.EXPENSE_SETTLED, {
              expenseId,
              status: expense.status,
            }),
          ),
        );
      }
    }

    return split;
  }

  async settleViaTransfer(expenseId: string, userId: string, username: string): Promise<{ transferId: string; split: ExpenseSplit }> {
    const expense = await this.expenseRepo.findOne({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException('Expense not found');

    const split = await this.splitRepo.findOne({ where: { expenseId, userId } });
    if (!split) throw new NotFoundException('Split not found for user');
    if (split.isPaid) throw new BadRequestException('Split is already paid');
    if (expense.createdBy === userId) throw new BadRequestException('Creator cannot settle own split');

    const creator = await this.usersService.findById(expense.createdBy);
    if (!creator) throw new NotFoundException('Expense creator not found');

    const transfer = await this.transfersService.create(userId, username, {
      toUsername: creator.username,
      amount: split.amountOwed,
      note: `Group expense ${expense.title} settlement`,
    });

    split.isPaid = true;
    split.amountPaid = split.amountOwed;
    split.paidAt = new Date();
    split.txHash = (transfer as any).txHash ?? transfer.id;
    await this.splitRepo.save(split);

    const remaining = await this.splitRepo.count({ where: { expenseId, isPaid: false } });
    expense.status = remaining === 0 ? GroupExpenseStatus.SETTLED : GroupExpenseStatus.PARTIALLY_SETTLED;
    await this.expenseRepo.save(expense);

    if (expense.status === GroupExpenseStatus.SETTLED) {
      const group = await this.groupsRepository.findByIdWithMembers(expense.groupId);
      if (group) {
        await Promise.all(
          group.members.map((member) =>
            this.gateway.emitToUser(member.userId, WS_EVENTS.EXPENSE_SETTLED, {
              expenseId,
              status: expense.status,
            }),
          ),
        );
      }
    }

    return { transferId: transfer.id, split };
  }

  async getExpenses(userId: string, groupId: string, query: { page?: number; limit?: number; status?: GroupExpenseStatus }) {
    await this.assertGroupMember(groupId, userId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const [data, total] = await this.expenseRepo.findAndCount({
      where: { groupId, ...(query.status ? { status: query.status } : {}) },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getUnsettledBalance(userId: string, groupId: string) {
    await this.assertGroupMember(groupId, userId);

    const unpaidSplits = await this.splitRepo.createQueryBuilder('s')
      .innerJoin('s.expense', 'e')
      .where('e.group_id = :groupId', { groupId })
      .andWhere('s.user_id = :userId', { userId })
      .andWhere('s.is_paid = false')
      .getMany();

    const totalOwed = unpaidSplits.reduce((s, split) => s + this.toNumber(split.amountOwed), 0);

    return {
      userId,
      amountOwed: this.ensureDecimal(totalOwed),
    };
  }

  async getGroupBalanceSummary(userId: string, groupId: string) {
    await this.assertGroupMember(groupId, userId);

    const rows = await this.splitRepo
      .createQueryBuilder('s')
      .select('s.user_id', 'userId')
      .addSelect('SUM(CAST(s.amount_paid AS numeric))', 'totalPaid')
      .addSelect('SUM(CAST(s.amount_owed AS numeric))', 'totalOwed')
      .innerJoin('s.expense', 'e')
      .where('e.group_id = :groupId', { groupId })
      .groupBy('s.user_id')
      .getRawMany();

    return rows.map((r) => ({
      userId: r.userId,
      net: this.ensureDecimal(parseFloat(r.totalPaid ?? '0') - parseFloat(r.totalOwed ?? '0')),
    }));
  }
}
