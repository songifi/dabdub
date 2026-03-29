import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';
import { User, KycStatus } from '../users/entities/user.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { PayLink, PayLinkStatus } from '../paylink/entities/pay-link.entity';
import { REDIS_CLIENT } from '../cache/redis.module';
import { TierName } from '../tier-config/entities/tier-config.entity';

const mockQb = (rows: unknown[]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(rows),
  getRawMany: jest.fn().mockResolvedValue([]),
});

const makeUserRepo = (rows: Partial<User>[]) => ({
  createQueryBuilder: jest.fn(() => mockQb(rows)),
});

const makeTxRepo = (rows: Partial<Transaction>[], contactRows: { username: string }[] = []) => {
  let callCount = 0;
  return {
    createQueryBuilder: jest.fn(() => {
      const qb = mockQb(rows);
      // getRawMany is used for contacts query
      qb.getRawMany = jest.fn().mockResolvedValue(contactRows);
      callCount++;
      return qb;
    }),
  };
};

const makePayLinkRepo = (rows: Partial<PayLink>[]) => ({
  createQueryBuilder: jest.fn(() => mockQb(rows)),
});

const mockRedis = { lpush: jest.fn().mockResolvedValue(1) };

const baseUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    username: 'temi',
    displayName: 'Temi A',
    avatarKey: null,
    bio: null,
    tier: TierName.SILVER,
    isMerchant: false,
    kycStatus: KycStatus.NONE,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as User);

const baseTx = (overrides: Partial<Transaction> = {}): Transaction =>
  ({
    id: 'tx1',
    userId: 'me',
    type: TransactionType.TRANSFER_OUT,
    amountUsdc: '10.00',
    amount: 10,
    fee: null,
    status: TransactionStatus.COMPLETED,
    counterpartyUsername: 'temi',
    description: 'coffee money',
    reference: 'REF001',
    metadata: {},
    createdAt: new Date('2024-06-01'),
    ...overrides,
  } as Transaction);

describe('SearchService', () => {
  let service: SearchService;
  let userRepo: ReturnType<typeof makeUserRepo>;
  let txRepo: ReturnType<typeof makeTxRepo>;
  let payLinkRepo: ReturnType<typeof makePayLinkRepo>;

  async function build(
    users: Partial<User>[] = [],
    txs: Partial<Transaction>[] = [],
    paylinks: Partial<PayLink>[] = [],
    contacts: { username: string }[] = [],
  ) {
    userRepo = makeUserRepo(users);
    txRepo = makeTxRepo(txs, contacts);
    payLinkRepo = makePayLinkRepo(paylinks);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getRepositoryToken(PayLink), useValue: payLinkRepo },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(SearchService);
  }

  beforeEach(() => jest.clearAllMocks());

  it('throws 400 when query is shorter than 2 chars', async () => {
    await build();
    await expect(service.search('me', 'a')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 400 for empty query', async () => {
    await build();
    await expect(service.search('me', '')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('query "temi" matches username in user results', async () => {
    await build([baseUser()]);
    const result = await service.search('me', 'temi');
    expect(result.users).toHaveLength(1);
    expect(result.users[0].username).toBe('temi');
  });

  it('query "coffee" matches transaction note', async () => {
    await build([], [baseTx({ description: 'coffee money' })]);
    const result = await service.search('me', 'coffee');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].note).toBe('coffee money');
  });

  it('contacts are boosted above non-contacts in user results', async () => {
    const contact = baseUser({ id: 'u2', username: 'contact_user', displayName: 'Contact' });
    const nonContact = baseUser({ id: 'u3', username: 'stranger', displayName: 'Stranger' });

    // userRepo returns non-contact first, then contact
    userRepo = makeUserRepo([nonContact, contact]);
    // txRepo returns contact username as a past counterparty
    txRepo = makeTxRepo([], [{ username: 'contact_user' }]);
    payLinkRepo = makePayLinkRepo([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getRepositoryToken(PayLink), useValue: payLinkRepo },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(SearchService);

    const result = await service.search('me', 'us');
    expect(result.users[0].username).toBe('contact_user');
    expect(result.users[1].username).toBe('stranger');
  });

  it('filters to only requested types', async () => {
    await build([baseUser()], [baseTx()]);
    const result = await service.search('me', 'temi', ['users']);
    expect(result.users).toHaveLength(1);
    expect(result.transactions).toHaveLength(0);
    expect(result.paylinks).toHaveLength(0);
  });

  it('logs query to Redis analytics list', async () => {
    await build([baseUser()]);
    await service.search('me', 'temi');
    expect(mockRedis.lpush).toHaveBeenCalledWith('search:queries', 'temi');
  });

  it('totalResults sums all category counts', async () => {
    const paylink = {
      id: 'pl1',
      creatorUserId: 'me',
      tokenId: 'ABC123',
      note: 'test',
      amount: '5',
      status: PayLinkStatus.ACTIVE,
      expiresAt: new Date(),
      createdTxHash: 'hash',
      paymentTxHash: null,
      sandbox: false,
      paidByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PayLink;

    await build([baseUser()], [baseTx()], [paylink]);
    const result = await service.search('me', 'te');
    expect(result.totalResults).toBe(3);
  });
});
