import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroupsModule } from '../src/groups/groups.module';
import { GroupsService } from '../src/groups/groups.service';
import { GroupsRepository } from '../src/groups/groups.repository';
import { StellarService } from '../src/stellar/stellar.service';
import { Group } from '../src/groups/entities/group.entity';
import { GroupMember, GroupMemberRole } from '../src/groups/entities/group-member.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

const MOCK_USER_ID = 'user-uuid-1';

const mockGroup: Group = {
  id: 'group-uuid',
  name: 'E2E Group',
  description: 'e2e test',
  avatarUrl: undefined,
  createdBy: MOCK_USER_ID,
  maxMembers: 100,
  isPublic: true,
  inviteCode: 'ABCDEF123456',
  isTokenGated: false,
  gateTokenAddress: undefined,
  gateMinBalance: undefined,
  onChainId: 'tx-hash',
  createdAt: new Date('2024-01-01'),
  deletedAt: undefined,
  members: [
    {
      id: 'm1',
      groupId: 'group-uuid',
      userId: MOCK_USER_ID,
      role: GroupMemberRole.OWNER,
      joinedAt: new Date(),
      group: {} as Group,
    },
  ],
};

describe('Groups (e2e)', () => {
  let app: INestApplication<App>;
  let groupsService: jest.Mocked<GroupsService>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [GroupsModule],
    })
      .overrideProvider(GroupsRepository)
      .useValue({})
      .overrideProvider(StellarService)
      .useValue({ getServer: jest.fn(), getBalance: jest.fn() })
      .overrideProvider(GroupsService)
      .useValue({
        createGroup: jest.fn(),
        getGroup: jest.fn(),
        searchGroups: jest.fn(),
        updateGroup: jest.fn(),
        deleteGroup: jest.fn(),
        generateInviteCode: jest.fn(),
        joinByInviteCode: jest.fn(),
        setTokenGate: jest.fn(),
        removeTokenGate: jest.fn(),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: MOCK_USER_ID };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    groupsService = moduleFixture.get(GroupsService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /groups ─────────────────────────────────────────────────────────────

  describe('POST /groups', () => {
    it('creates a group and returns 201', async () => {
      groupsService.createGroup.mockResolvedValue({
        id: mockGroup.id,
        name: mockGroup.name,
        description: mockGroup.description,
        createdBy: MOCK_USER_ID,
        maxMembers: 100,
        isPublic: true,
        inviteCode: 'ABCDEF123456',
        isTokenGated: false,
        memberCount: 1,
        createdAt: mockGroup.createdAt,
      });

      const res = await request(app.getHttpServer())
        .post('/groups')
        .send({ name: 'E2E Group' })
        .expect(201);

      expect(res.body.name).toBe('E2E Group');
      expect(res.body.inviteCode).toBe('ABCDEF123456');
    });

    it('returns 400 for missing name', async () => {
      await request(app.getHttpServer()).post('/groups').send({}).expect(400);
    });
  });

  // ── GET /groups/search ───────────────────────────────────────────────────────

  describe('GET /groups/search', () => {
    it('returns paginated search results', async () => {
      groupsService.searchGroups.mockResolvedValue({
        data: [{ id: mockGroup.id, name: 'E2E Group', createdBy: MOCK_USER_ID, maxMembers: 100, isPublic: true, isTokenGated: false, memberCount: 1, createdAt: mockGroup.createdAt }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app.getHttpServer())
        .get('/groups/search?name=E2E')
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data[0].name).toBe('E2E Group');
    });
  });

  // ── GET /groups/:id ──────────────────────────────────────────────────────────

  describe('GET /groups/:id', () => {
    it('returns group by id', async () => {
      groupsService.getGroup.mockResolvedValue({
        id: mockGroup.id,
        name: mockGroup.name,
        createdBy: MOCK_USER_ID,
        maxMembers: 100,
        isPublic: true,
        isTokenGated: false,
        memberCount: 1,
        createdAt: mockGroup.createdAt,
      });

      const res = await request(app.getHttpServer())
        .get(`/groups/${mockGroup.id}`)
        .expect(200);

      expect(res.body.id).toBe(mockGroup.id);
    });

    it('returns 400 for invalid UUID', async () => {
      await request(app.getHttpServer()).get('/groups/not-a-uuid').expect(400);
    });
  });

  // ── PATCH /groups/:id ────────────────────────────────────────────────────────

  describe('PATCH /groups/:id', () => {
    it('updates group', async () => {
      groupsService.updateGroup.mockResolvedValue({
        id: mockGroup.id,
        name: 'Updated Name',
        createdBy: MOCK_USER_ID,
        maxMembers: 100,
        isPublic: true,
        isTokenGated: false,
        memberCount: 1,
        createdAt: mockGroup.createdAt,
      });

      const res = await request(app.getHttpServer())
        .patch(`/groups/${mockGroup.id}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });
  });

  // ── DELETE /groups/:id ───────────────────────────────────────────────────────

  describe('DELETE /groups/:id', () => {
    it('soft-deletes group and returns 200', async () => {
      groupsService.deleteGroup.mockResolvedValue(undefined);
      await request(app.getHttpServer())
        .delete(`/groups/${mockGroup.id}`)
        .expect(200);
    });
  });

  // ── POST /groups/:id/invite-code ─────────────────────────────────────────────

  describe('POST /groups/:id/invite-code', () => {
    it('regenerates invite code', async () => {
      groupsService.generateInviteCode.mockResolvedValue({ inviteCode: 'NEWCODE123456' });

      const res = await request(app.getHttpServer())
        .post(`/groups/${mockGroup.id}/invite-code`)
        .expect(201);

      expect(res.body.inviteCode).toBe('NEWCODE123456');
    });
  });

  // ── POST /groups/join/:inviteCode ────────────────────────────────────────────

  describe('POST /groups/join/:inviteCode', () => {
    it('joins group by invite code', async () => {
      groupsService.joinByInviteCode.mockResolvedValue({
        id: mockGroup.id,
        name: mockGroup.name,
        createdBy: MOCK_USER_ID,
        maxMembers: 100,
        isPublic: true,
        isTokenGated: false,
        memberCount: 2,
        createdAt: mockGroup.createdAt,
      });

      const res = await request(app.getHttpServer())
        .post('/groups/join/ABCDEF123456')
        .expect(201);

      expect(res.body.memberCount).toBe(2);
    });
  });

  // ── POST /groups/:id/gate ────────────────────────────────────────────────────

  describe('POST /groups/:id/gate', () => {
    it('sets token gate', async () => {
      groupsService.setTokenGate.mockResolvedValue({
        id: mockGroup.id,
        name: mockGroup.name,
        createdBy: MOCK_USER_ID,
        maxMembers: 100,
        isPublic: true,
        isTokenGated: true,
        gateTokenAddress: 'USDC:GABC',
        gateMinBalance: 10,
        memberCount: 1,
        createdAt: mockGroup.createdAt,
      });

      const res = await request(app.getHttpServer())
        .post(`/groups/${mockGroup.id}/gate`)
        .send({ gateTokenAddress: 'USDC:GABC', gateMinBalance: 10 })
        .expect(201);

      expect(res.body.isTokenGated).toBe(true);
      expect(res.body.gateTokenAddress).toBe('USDC:GABC');
    });
  });
});
