import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GroupsService } from './groups.service';
import { GroupsRepository } from './groups.repository';
import { StellarService } from '../stellar/stellar.service';
import { Group } from './entities/group.entity';
import { GroupMember, GroupMemberRole } from './entities/group-member.entity';

const mockGroup = (overrides: Partial<Group> = {}): Group => ({
  id: 'group-uuid',
  name: 'Test Group',
  description: 'desc',
  avatarUrl: undefined,
  createdBy: 'user-1',
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
    { id: 'm1', groupId: 'group-uuid', userId: 'user-1', role: GroupMemberRole.OWNER, joinedAt: new Date(), group: {} as Group },
  ],
  ...overrides,
});

describe('GroupsService', () => {
  let service: GroupsService;
  let repo: jest.Mocked<GroupsRepository>;
  let stellar: jest.Mocked<StellarService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: GroupsRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findByIdWithMembers: jest.fn(),
            findByInviteCode: jest.fn(),
            search: jest.fn(),
            countMembers: jest.fn(),
            isMember: jest.fn(),
            addMember: jest.fn(),
            softDeleteGroup: jest.fn(),
          },
        },
        {
          provide: StellarService,
          useValue: {
            getServer: jest.fn(),
            getBalance: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(GroupsService);
    repo = module.get(GroupsRepository);
    stellar = module.get(StellarService);
  });

  // ── createGroup ─────────────────────────────────────────────────────────────

  describe('createGroup', () => {
    it('creates group and adds creator as owner', async () => {
      const group = mockGroup();
      jest.spyOn(service as any, 'syncOnChain').mockResolvedValue('tx-hash');
      repo.create.mockReturnValue(group);
      repo.save.mockResolvedValue(group);
      repo.addMember.mockResolvedValue({} as GroupMember);
      repo.findByIdWithMembers.mockResolvedValue(group);

      const result = await service.createGroup({ name: 'Test Group' }, 'user-1');

      expect(repo.save).toHaveBeenCalled();
      expect(repo.addMember).toHaveBeenCalledWith(group.id, 'user-1', GroupMemberRole.OWNER);
      expect(result.name).toBe('Test Group');
    });

    it('throws if on-chain sync fails', async () => {
      jest.spyOn(service as any, 'syncOnChain').mockRejectedValue(new Error('network error'));
      await expect(service.createGroup({ name: 'X' }, 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── getGroup ────────────────────────────────────────────────────────────────

  describe('getGroup', () => {
    it('returns group response dto', async () => {
      repo.findByIdWithMembers.mockResolvedValue(mockGroup());
      const result = await service.getGroup('group-uuid');
      expect(result.id).toBe('group-uuid');
      expect(result.memberCount).toBe(1);
    });

    it('throws NotFoundException for missing group', async () => {
      repo.findByIdWithMembers.mockResolvedValue(null);
      await expect(service.getGroup('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── searchGroups ────────────────────────────────────────────────────────────

  describe('searchGroups', () => {
    it('returns paginated results', async () => {
      repo.search.mockResolvedValue([[mockGroup()], 1]);
      const result = await service.searchGroups({ name: 'Test', page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  // ── updateGroup ─────────────────────────────────────────────────────────────

  describe('updateGroup', () => {
    it('updates group when caller is owner', async () => {
      const group = mockGroup();
      repo.findByIdWithMembers.mockResolvedValue(group);
      repo.save.mockResolvedValue({ ...group, name: 'Updated' });
      repo.findByIdWithMembers.mockResolvedValueOnce(group).mockResolvedValueOnce({ ...group, name: 'Updated' });

      const result = await service.updateGroup('group-uuid', { name: 'Updated' }, 'user-1');
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws ForbiddenException for non-owner', async () => {
      repo.findByIdWithMembers.mockResolvedValue(mockGroup());
      await expect(service.updateGroup('group-uuid', { name: 'X' }, 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── deleteGroup ─────────────────────────────────────────────────────────────

  describe('deleteGroup', () => {
    it('soft-deletes group', async () => {
      repo.findByIdWithMembers.mockResolvedValue(mockGroup());
      repo.softDeleteGroup.mockResolvedValue(undefined);
      await service.deleteGroup('group-uuid', 'user-1');
      expect(repo.softDeleteGroup).toHaveBeenCalledWith('group-uuid');
    });
  });

  // ── generateInviteCode ──────────────────────────────────────────────────────

  describe('generateInviteCode', () => {
    it('generates a new unique invite code', async () => {
      const group = mockGroup();
      repo.findByIdWithMembers.mockResolvedValue(group);
      repo.save.mockResolvedValue(group);

      const result = await service.generateInviteCode('group-uuid', 'user-1');
      expect(result.inviteCode).toHaveLength(12);
      expect(result.inviteCode).not.toBe('ABCDEF123456');
    });
  });

  // ── joinByInviteCode ────────────────────────────────────────────────────────

  describe('joinByInviteCode', () => {
    it('allows joining with valid invite code', async () => {
      const group = mockGroup();
      repo.findByInviteCode.mockResolvedValue(group);
      repo.isMember.mockResolvedValue(false);
      repo.countMembers.mockResolvedValue(1);
      repo.addMember.mockResolvedValue({} as GroupMember);
      repo.findByIdWithMembers.mockResolvedValue(group);

      const result = await service.joinByInviteCode('ABCDEF123456', 'user-2');
      expect(repo.addMember).toHaveBeenCalledWith(group.id, 'user-2');
    });

    it('throws if already a member', async () => {
      repo.findByInviteCode.mockResolvedValue(mockGroup());
      repo.isMember.mockResolvedValue(true);
      await expect(service.joinByInviteCode('ABCDEF123456', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws if group is full', async () => {
      repo.findByInviteCode.mockResolvedValue(mockGroup({ maxMembers: 1 }));
      repo.isMember.mockResolvedValue(false);
      repo.countMembers.mockResolvedValue(1);
      await expect(service.joinByInviteCode('ABCDEF123456', 'user-2')).rejects.toThrow(BadRequestException);
    });

    it('throws if invite code is invalid', async () => {
      repo.findByInviteCode.mockResolvedValue(null);
      await expect(service.joinByInviteCode('INVALID', 'user-2')).rejects.toThrow(NotFoundException);
    });
  });

  // ── token gate ──────────────────────────────────────────────────────────────

  describe('setTokenGate', () => {
    it('sets token gate on group', async () => {
      const group = mockGroup();
      repo.findByIdWithMembers.mockResolvedValue(group);
      repo.save.mockResolvedValue(group);
      repo.findByIdWithMembers.mockResolvedValueOnce(group).mockResolvedValueOnce({
        ...group,
        isTokenGated: true,
        gateTokenAddress: 'USDC:GABC',
        gateMinBalance: 10,
      });

      const result = await service.setTokenGate(
        'group-uuid',
        { gateTokenAddress: 'USDC:GABC', gateMinBalance: 10 },
        'user-1',
      );
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('joinByInviteCode with token gate', () => {
    it('blocks join if token balance insufficient', async () => {
      const group = mockGroup({
        isTokenGated: true,
        gateTokenAddress: 'USDC:GABC',
        gateMinBalance: 100,
      });
      repo.findByInviteCode.mockResolvedValue(group);
      repo.isMember.mockResolvedValue(false);
      repo.countMembers.mockResolvedValue(1);
      stellar.getBalance.mockResolvedValue([
        { asset_code: 'USDC', asset_issuer: 'GABC', balance: '5.0000000' },
      ]);

      await expect(service.joinByInviteCode('ABCDEF123456', 'GSTELLARKEY')).rejects.toThrow(ForbiddenException);
    });

    it('allows join if token balance sufficient', async () => {
      const group = mockGroup({
        isTokenGated: true,
        gateTokenAddress: 'USDC:GABC',
        gateMinBalance: 10,
      });
      repo.findByInviteCode.mockResolvedValue(group);
      repo.isMember.mockResolvedValue(false);
      repo.countMembers.mockResolvedValue(1);
      stellar.getBalance.mockResolvedValue([
        { asset_code: 'USDC', asset_issuer: 'GABC', balance: '50.0000000' },
      ]);
      repo.addMember.mockResolvedValue({} as GroupMember);
      repo.findByIdWithMembers.mockResolvedValue(group);

      await expect(service.joinByInviteCode('ABCDEF123456', 'GSTELLARKEY')).resolves.toBeDefined();
    });
  });

  // ── removeTokenGate ─────────────────────────────────────────────────────────

  describe('removeTokenGate', () => {
    it('removes token gate', async () => {
      const group = mockGroup({ isTokenGated: true, gateTokenAddress: 'USDC:GABC', gateMinBalance: 10 });
      repo.findByIdWithMembers.mockResolvedValue(group);
      repo.save.mockResolvedValue(group);
      repo.findByIdWithMembers.mockResolvedValueOnce(group).mockResolvedValueOnce({
        ...group,
        isTokenGated: false,
      });

      await service.removeTokenGate('group-uuid', 'user-1');
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
