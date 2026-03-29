import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroupExpensesService } from './group-expenses.service';
import { GroupExpense, GroupExpenseSplitType, GroupExpenseStatus } from './entities/group-expense.entity';
import { ExpenseSplit } from './entities/expense-split.entity';
import { GroupsRepository } from '../groups/groups.repository';
import { UsersService } from '../users/users.service';
import { TransfersService } from '../transfers/transfers.service';
import { CheeseGateway, WS_EVENTS } from '../ws/cheese.gateway';
import { CreateGroupExpenseDto } from './dto/create-group-expense.dto';

describe('GroupExpensesService', () => {
  let service: GroupExpensesService;
  let expenseRepo: any;
  let splitRepo: any;
  let groupsRepo: any;
  let usersService: any;
  let transfersService: any;
  let gateway: any;

  beforeEach(async () => {
    expenseRepo = { save: jest.fn(), update: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn() };
    splitRepo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    groupsRepo = {
      findByIdWithMembers: jest.fn(),
      isMember: jest.fn(),
    };
    usersService = { findById: jest.fn() };
    transfersService = { create: jest.fn() };
    gateway = { emitToUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupExpensesService,
        { provide: getRepositoryToken(GroupExpense), useValue: expenseRepo },
        { provide: getRepositoryToken(ExpenseSplit), useValue: splitRepo },
        { provide: GroupsRepository, useValue: groupsRepo },
        { provide: UsersService, useValue: usersService },
        { provide: TransfersService, useValue: transfersService },
        { provide: CheeseGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(GroupExpensesService);
  });

  it('creates equal split and assigns remainder to creator', async () => {
    groupsRepo.findByIdWithMembers.mockResolvedValue({
      id: 'g1',
      members: [{ userId: 'creator' }, { userId: 'u2' }, { userId: 'u3' }],
    });

    expenseRepo.save.mockImplementation(async (e) => ({ ...e, id: 'e1' }));
    splitRepo.save.mockImplementation(async (s) => s);

    const dto: CreateGroupExpenseDto = {
      title: 'pizza',
      totalAmount: '100.000001',
      tokenId: 'usdc',
      splitType: GroupExpenseSplitType.EQUAL,
      conversationId: 'c1',
    };

    const expense = await service.createExpense('creator', dto, 'g1');

    expect(expense.status).toBe(GroupExpenseStatus.OPEN);
    expect(expenseRepo.save).toHaveBeenCalled();
    expect(splitRepo.save).toHaveBeenCalled();
    expect(gateway.emitToUser).toHaveBeenCalledTimes(3);
  });

  it('settles via transfer for participant and updates status', async () => {
    expenseRepo.findOne.mockResolvedValue({ id: 'e1', groupId: 'g1', createdBy: 'creator', title: 'pizza' });
    splitRepo.findOne.mockResolvedValue({ id: 's1', expenseId: 'e1', userId: 'u2', amountOwed: '33.333333', isPaid: false });
    usersService.findById.mockResolvedValue({ id: 'creator', username: 'creatorname' });
    transfersService.create.mockResolvedValue({ id: 't1', txHash: 'tx1' });
    splitRepo.save.mockResolvedValue({ id: 's1', isPaid: true });
    splitRepo.count.mockResolvedValue(0);
    groupsRepo.findByIdWithMembers.mockResolvedValue({ members: [{ userId: 'creator' }, { userId: 'u2' }, { userId: 'u3' }] });

    const result = await service.settleViaTransfer('e1', 'u2', 'u2name');

    expect(result.transferId).toBe('t1');
    expect(splitRepo.save).toHaveBeenCalled();
    expect(gateway.emitToUser).toHaveBeenCalledWith('creator', WS_EVENTS.EXPENSE_SETTLED, expect.any(Object));
  });
});
