import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { StellarService } from '../stellar/stellar.service';
import { GroupsRepository } from './groups.repository';
import { Group } from './entities/group.entity';
import { GroupMemberRole } from './entities/group-member.entity';
import {
  CreateGroupDto,
  GroupResponseDto,
  SearchGroupsDto,
  SetTokenGateDto,
  UpdateGroupDto,
} from './dto/groups.dto';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly repo: GroupsRepository,
    private readonly stellarService: StellarService,
  ) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async createGroup(dto: CreateGroupDto, userId: string): Promise<GroupResponseDto> {
    const inviteCode = this.generateCode();

    // Sync on-chain: record group creation on Stellar (best-effort)
    let onChainId: string | undefined;
    try {
      onChainId = await this.syncOnChain(userId, dto.name);
    } catch (err: any) {
      this.logger.warn(`On-chain group sync failed: ${err.message}`);
      throw new BadRequestException(
        `On-chain group creation failed: ${err.message}`,
      );
    }

    const group = this.repo.create({
      name: dto.name,
      description: dto.description,
      avatarUrl: dto.avatarUrl,
      createdBy: userId,
      maxMembers: dto.maxMembers ?? 100,
      isPublic: dto.isPublic ?? true,
      inviteCode,
      onChainId,
    });

    const saved = await this.repo.save(group);

    // Creator becomes owner
    await this.repo.addMember(saved.id, userId, GroupMemberRole.OWNER);

    return GroupResponseDto.from(await this.repo.findByIdWithMembers(saved.id) as Group);
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  async getGroup(id: string): Promise<GroupResponseDto> {
    const group = await this.repo.findByIdWithMembers(id);
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return GroupResponseDto.from(group);
  }

  async searchGroups(dto: SearchGroupsDto): Promise<{
    data: GroupResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const [groups, total] = await this.repo.search(dto.name, page, limit);
    return {
      data: groups.map(GroupResponseDto.from),
      total,
      page,
      limit,
    };
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async updateGroup(
    id: string,
    dto: UpdateGroupDto,
    userId: string,
  ): Promise<GroupResponseDto> {
    const group = await this.assertOwnerOrAdmin(id, userId);
    Object.assign(group, dto);
    await this.repo.save(group);
    return GroupResponseDto.from(await this.repo.findByIdWithMembers(id) as Group);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async deleteGroup(id: string, userId: string): Promise<void> {
    await this.assertOwnerOrAdmin(id, userId);
    await this.repo.softDeleteGroup(id);
    this.logger.log(`Group ${id} soft-deleted by ${userId}`);
    // Member notification is handled via EventEmitter (see groups.module.ts)
  }

  // ── Invite code ─────────────────────────────────────────────────────────────

  async generateInviteCode(id: string, userId: string): Promise<{ inviteCode: string }> {
    const group = await this.assertOwnerOrAdmin(id, userId);
    group.inviteCode = this.generateCode();
    await this.repo.save(group);
    return { inviteCode: group.inviteCode };
  }

  // ── Join by invite code ─────────────────────────────────────────────────────

  async joinByInviteCode(inviteCode: string, userId: string): Promise<GroupResponseDto> {
    const group = await this.repo.findByInviteCode(inviteCode);
    if (!group) throw new NotFoundException('Invalid invite code');

    await this.assertCanJoin(group, userId);

    await this.repo.addMember(group.id, userId);
    return GroupResponseDto.from(await this.repo.findByIdWithMembers(group.id) as Group);
  }

  // ── Token gate ──────────────────────────────────────────────────────────────

  async setTokenGate(
    id: string,
    dto: SetTokenGateDto,
    userId: string,
  ): Promise<GroupResponseDto> {
    const group = await this.assertOwnerOrAdmin(id, userId);
    group.isTokenGated = true;
    group.gateTokenAddress = dto.gateTokenAddress;
    group.gateMinBalance = dto.gateMinBalance;
    await this.repo.save(group);
    return GroupResponseDto.from(await this.repo.findByIdWithMembers(id) as Group);
  }

  async removeTokenGate(id: string, userId: string): Promise<GroupResponseDto> {
    const group = await this.assertOwnerOrAdmin(id, userId);
    group.isTokenGated = false;
    group.gateTokenAddress = undefined;
    group.gateMinBalance = undefined;
    await this.repo.save(group);
    return GroupResponseDto.from(await this.repo.findByIdWithMembers(id) as Group);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private generateCode(): string {
    return randomBytes(6).toString('hex').toUpperCase(); // 12-char hex
  }

  /**
   * Syncs group creation on Stellar by submitting a manage_data operation
   * that records the group name on the treasury account as proof-of-creation.
   * Returns the transaction hash used as the on-chain group ID.
   */
  private async syncOnChain(creatorId: string, groupName: string): Promise<string> {
    const server = this.stellarService.getServer();
    const secret = process.env.STELLAR_ACCOUNT_SECRET;
    if (!secret) throw new Error('STELLAR_ACCOUNT_SECRET not configured');

    const StellarSdk = await import('@stellar/stellar-sdk');
    const keypair = StellarSdk.Keypair.fromSecret(secret);
    const account = await server.loadAccount(keypair.publicKey());

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase:
        process.env.STELLAR_NETWORK_PASSPHRASE ?? StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.manageData({
          name: `group:${creatorId.slice(0, 8)}`,
          value: groupName.slice(0, 64),
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await server.submitTransaction(tx);
    return (result as any).hash as string;
  }

  private async assertOwnerOrAdmin(groupId: string, userId: string): Promise<Group> {
    const group = await this.repo.findByIdWithMembers(groupId);
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);

    const member = group.members?.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== GroupMemberRole.OWNER && member.role !== GroupMemberRole.ADMIN)
    ) {
      throw new ForbiddenException('Only group owner or admin can perform this action');
    }
    return group;
  }

  private async assertCanJoin(group: Group, userId: string): Promise<void> {
    if (await this.repo.isMember(group.id, userId)) {
      throw new BadRequestException('Already a member of this group');
    }

    const memberCount = await this.repo.countMembers(group.id);
    if (memberCount >= group.maxMembers) {
      throw new BadRequestException('Group is full');
    }

    if (group.isTokenGated && group.gateTokenAddress && group.gateMinBalance != null) {
      await this.verifyTokenGate(userId, group.gateTokenAddress, group.gateMinBalance);
    }
  }

  /**
   * Verifies the user holds at least gateMinBalance of the gated token
   * by querying Stellar Horizon account balances.
   * userId is expected to be a Stellar public key in token-gated groups.
   */
  private async verifyTokenGate(
    stellarAccountId: string,
    tokenAddress: string,
    minBalance: number,
  ): Promise<void> {
    let balances: any[];
    try {
      balances = await this.stellarService.getBalance(stellarAccountId);
    } catch {
      throw new ForbiddenException(
        'Could not verify token balance on Stellar Horizon',
      );
    }

    // tokenAddress format: "ASSET_CODE:ISSUER" or just asset code for native XLM
    const [assetCode, issuer] = tokenAddress.split(':');
    const balance = balances.find((b: any) => {
      if (assetCode === 'XLM') return b.asset_type === 'native';
      return b.asset_code === assetCode && (!issuer || b.asset_issuer === issuer);
    });

    if (!balance || parseFloat(balance.balance) < minBalance) {
      throw new ForbiddenException(
        `Insufficient token balance. Required: ${minBalance} ${assetCode}`,
      );
    }
  }
}
