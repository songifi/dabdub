import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { Connection, DeepPartial, Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember, GroupMemberRole } from './entities/group-member.entity';

@Injectable()
export class GroupsRepository {
  constructor(
    @InjectConnection() private readonly dataSource: Connection,
    @InjectRepository(Group)
    private readonly groups: Repository<Group>,
  ) {}

  create(entityLike?: DeepPartial<Group>): Group {
    return this.groups.create(entityLike);
  }

  save(entity: Group): Promise<Group> {
    return this.groups.save(entity);
  }

  async findByIdWithMembers(id: string): Promise<Group | null> {
    return this.groups
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.members', 'm')
      .where('g.id = :id', { id })
      .andWhere('g.deletedAt IS NULL')
      .getOne();
  }

  async findByInviteCode(inviteCode: string): Promise<Group | null> {
    return this.groups
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.members', 'm')
      .where('g.inviteCode = :inviteCode', { inviteCode })
      .andWhere('g.deletedAt IS NULL')
      .getOne();
  }

  async search(
    name: string | undefined,
    page: number,
    limit: number,
  ): Promise<[Group[], number]> {
    const qb = this.groups
      .createQueryBuilder('g')
      .leftJoin('g.members', 'm')
      .addSelect('COUNT(m.id)', 'memberCount')
      .where('g.deletedAt IS NULL')
      .groupBy('g.id')
      .orderBy('g.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (name) {
      qb.andWhere('g.name ILIKE :name', { name: `%${name}%` });
    }

    const [groups, total] = await qb.getManyAndCount();
    return [groups, total];
  }

  async countMembers(groupId: string): Promise<number> {
    return this.dataSource.getRepository(GroupMember).count({ where: { groupId } });
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const count = await this.dataSource
      .getRepository(GroupMember)
      .count({ where: { groupId, userId } });
    return count > 0;
  }

  async addMember(
    groupId: string,
    userId: string,
    role: GroupMemberRole = GroupMemberRole.MEMBER,
  ): Promise<GroupMember> {
    const member = this.dataSource.getRepository(GroupMember).create({
      groupId,
      userId,
      role,
    });
    return this.dataSource.getRepository(GroupMember).save(member);
  }

  async softDeleteGroup(id: string): Promise<void> {
    await this.groups.softDelete(id);
  }
}
