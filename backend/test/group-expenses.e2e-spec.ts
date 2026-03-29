import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { GroupExpensesModule } from '../src/group-expenses/group-expenses.module';
import { GroupExpensesService } from '../src/group-expenses/group-expenses.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

const MOCK_USER_ID = 'user-uuid-1';

describe('GroupExpenses (e2e)', () => {
  let app: INestApplication;
  let service: jest.Mocked<GroupExpensesService>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [GroupExpensesModule],
    })
      .overrideProvider(GroupExpensesService)
      .useValue({
        createExpense: jest.fn(),
        getExpenses: jest.fn(),
        getGroupBalanceSummary: jest.fn(),
        settleViaTransfer: jest.fn(),
        updateSplits: jest.fn(),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: MOCK_USER_ID, username: 'testname' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    service = moduleFixture.get(GroupExpensesService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /groups/:id/expenses calls createExpense', async () => {
    service.createExpense.mockResolvedValue({ id: 'e1' } as any);

    const res = await request(app.getHttpServer())
      .post('/groups/g1/expenses')
      .send({ title: 'Pizza', totalAmount: '60.000000', tokenId: 'usdc', splitType: 'EQUAL' })
      .expect(201);

    expect(res.body.id).toBe('e1');
    expect(service.createExpense).toHaveBeenCalled();
  });

  it('GET /groups/:id/expenses returns list', async () => {
    service.getExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const res = await request(app.getHttpServer()).get('/groups/g1/expenses').expect(200);
    expect(res.body.total).toBe(0);
  });

  it('GET /groups/:id/expenses/balance returns summary', async () => {
    service.getGroupBalanceSummary.mockResolvedValue([{ userId: 'u1', net: '0.000000' }]);

    const res = await request(app.getHttpServer()).get('/groups/g1/expenses/balance').expect(200);
    expect(res.body[0].userId).toBe('u1');
  });

  it('POST /expenses/:id/settle calls settleViaTransfer', async () => {
    service.settleViaTransfer.mockResolvedValue({ transferId: 't1' });

    const res = await request(app.getHttpServer()).post('/expenses/e1/settle').expect(201);
    expect(res.body.transferId).toBe('t1');
  });

  it('PATCH /expenses/:id/splits calls updateSplits', async () => {
    service.updateSplits.mockResolvedValue([{ userId: 'u1', amountOwed: '20.000000' }] as any);

    const res = await request(app.getHttpServer())
      .patch('/expenses/e1/splits')
      .send({ splits: [{ userId: 'u1', amountOwed: '20.000000' }] })
      .expect(200);

    expect(res.body[0].amountOwed).toBe('20.000000');
  });
});
