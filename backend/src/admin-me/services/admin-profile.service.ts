import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { UpdateOwnProfileDto } from '../dto/update-own-profile.dto';
import { AuditLogService } from '../../audit/audit-log.service';

@Injectable()
export class AdminProfileService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
        private readonly auditLogService: AuditLogService,
    ) { }

    async getProfile(adminId: string) {
        const admin = await this.userRepository.findOne({
            where: { id: adminId },
        });
        if (!admin) {
            throw new NotFoundException('Admin not found');
        }
        return admin;
    }

    async updateProfile(adminId: string, dto: UpdateOwnProfileDto) {
        const admin = await this.getProfile(adminId);

        Object.assign(admin, dto);

        return this.userRepository.save(admin);
    }

    async getAuditLog(adminId: string, query: { page?: number; limit?: number }) {
        const { page = 1, limit = 10 } = query;
        return this.auditLogService.search({
            actorId: adminId,
            limit,
            offset: (page - 1) * limit,
        });
    }
}
