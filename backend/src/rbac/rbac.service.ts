import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminPermission } from './entities/admin-permission.entity';
import { Permission } from './rbac.types';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(AdminPermission)
    private readonly permRepo: Repository<AdminPermission>,
  ) {}

  async list(adminId: string): Promise<AdminPermission[]> {
    return this.permRepo.find({ where: { adminId }, order: { grantedAt: 'DESC' } });
  }

  async grant(adminId: string, permission: Permission, grantedBy: string): Promise<AdminPermission> {
    const row = this.permRepo.create({
      adminId,
      permission,
      grantedBy,
      grantedAt: new Date(),
    });
    return this.permRepo.save(row);
  }

  async revoke(adminId: string, permission: Permission): Promise<void> {
    await this.permRepo.delete({ adminId, permission });
  }
}

