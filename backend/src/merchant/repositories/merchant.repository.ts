import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, FindManyOptions, ILike, In } from 'typeorm';
import {
    Merchant,
    MerchantStatus,
    KycStatus,
    BankAccountStatus,
} from '../../database/entities/merchant.entity';
import { SearchMerchantsDto } from '../dto/merchant.dto';

/**
 * Repository for merchant data access operations
 */
@Injectable()
export class MerchantRepository {
    constructor(
        @InjectRepository(Merchant)
        private readonly repository: Repository<Merchant>,
    ) {}

    /**
     * Create a new merchant
     */
    async create(merchantData: Partial<Merchant>): Promise<Merchant> {
        const merchant = this.repository.create(merchantData);
        return this.repository.save(merchant);
    }

    /**
     * Find merchant by ID
     */
    async findById(id: string): Promise<Merchant | null> {
        return this.repository.findOne({ where: { id } });
    }

    /**
     * Find merchant by email
     */
    async findByEmail(email: string): Promise<Merchant | null> {
        return this.repository.findOne({ where: { email: email.toLowerCase() } });
    }

    /**
     * Find merchant by verification token
     */
    async findByVerificationToken(token: string): Promise<Merchant | null> {
        return this.repository.findOne({ where: { emailVerificationToken: token } });
    }

    /**
     * Update merchant by ID
     */
    async update(id: string, updateData: Partial<Merchant>): Promise<Merchant | null> {
        await this.repository.update(id, updateData as any);
        return this.findById(id);
    }

    /**
     * Delete merchant by ID
     */
    async delete(id: string): Promise<void> {
        await this.repository.delete(id);
    }

    /**
     * Check if merchant exists by email
     */
    async existsByEmail(email: string): Promise<boolean> {
        const count = await this.repository.count({ where: { email: email.toLowerCase() } });
        return count > 0;
    }

    /**
     * Find merchants by status
     */
    async findByStatus(status: MerchantStatus): Promise<Merchant[]> {
        return this.repository.find({ where: { status } });
    }

    /**
     * Find merchants by KYC status
     */
    async findByKycStatus(kycStatus: KycStatus): Promise<Merchant[]> {
        return this.repository.find({ where: { kycStatus } });
    }

    /**
     * Search and filter merchants with pagination
     */
    async search(searchDto: SearchMerchantsDto): Promise<{ data: Merchant[]; total: number }> {
        const {
            search,
            status,
            kycStatus,
            businessType,
            country,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
        } = searchDto;

        const queryBuilder = this.repository.createQueryBuilder('merchant');

        // Apply search filter
        if (search) {
            queryBuilder.andWhere(
                '(merchant.name ILIKE :search OR merchant.businessName ILIKE :search OR merchant.email ILIKE :search)',
                { search: `%${search}%` },
            );
        }

        // Apply status filter
        if (status) {
            queryBuilder.andWhere('merchant.status = :status', { status });
        }

        // Apply KYC status filter
        if (kycStatus) {
            queryBuilder.andWhere('merchant.kycStatus = :kycStatus', { kycStatus });
        }

        // Apply business type filter
        if (businessType) {
            queryBuilder.andWhere('merchant.businessType = :businessType', { businessType });
        }

        // Apply country filter
        if (country) {
            queryBuilder.andWhere('merchant.country = :country', { country });
        }

        // Apply sorting
        const validSortFields = ['createdAt', 'name', 'businessName', 'status', 'updatedAt'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        queryBuilder.orderBy(`merchant.${sortField}`, sortOrder);

        // Apply pagination
        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).take(limit);

        // Execute query
        const [data, total] = await queryBuilder.getManyAndCount();

        return { data, total };
    }

    /**
     * Count merchants by status
     */
    async countByStatus(status: MerchantStatus): Promise<number> {
        return this.repository.count({ where: { status } });
    }

    /**
     * Count merchants by KYC status
     */
    async countByKycStatus(kycStatus: KycStatus): Promise<number> {
        return this.repository.count({ where: { kycStatus } });
    }

    /**
     * Get merchants with pending KYC
     */
    async findPendingKycMerchants(limit?: number): Promise<Merchant[]> {
        const query = this.repository
            .createQueryBuilder('merchant')
            .where('merchant.kycStatus IN (:...statuses)', {
                statuses: [KycStatus.PENDING, KycStatus.IN_REVIEW],
            })
            .orderBy('merchant.kycSubmittedAt', 'ASC');

        if (limit) {
            query.take(limit);
        }

        return query.getMany();
    }

    /**
     * Get merchants with unverified bank accounts
     */
    async findUnverifiedBankAccounts(): Promise<Merchant[]> {
        return this.repository.find({
            where: {
                bankAccountStatus: BankAccountStatus.PENDING,
            },
            order: { updatedAt: 'ASC' },
        });
    }

    /**
     * Find merchants by IDs
     */
    async findByIds(ids: string[]): Promise<Merchant[]> {
        return this.repository.find({
            where: { id: In(ids) },
        });
    }

    /**
     * Update merchant status
     */
    async updateStatus(
        id: string,
        status: MerchantStatus,
        additionalData?: Partial<Merchant>,
    ): Promise<Merchant | null> {
        const updateData: Partial<Merchant> = {
            status,
            ...additionalData,
        };

        if (status === MerchantStatus.CLOSED && !updateData.closedAt) {
            updateData.closedAt = new Date();
        }

        await this.repository.update(id, updateData as any);
        return this.findById(id);
    }

    /**
     * Update KYC status
     */
    async updateKycStatus(
        id: string,
        kycStatus: KycStatus,
        additionalData?: Partial<Merchant>,
    ): Promise<Merchant | null> {
        const updateData: Partial<Merchant> = {
            kycStatus,
            ...additionalData,
        };

        if (kycStatus === KycStatus.APPROVED && !updateData.kycVerifiedAt) {
            updateData.kycVerifiedAt = new Date();
        }

        await this.repository.update(id, updateData as any);
        return this.findById(id);
    }

    /**
     * Update bank account status
     */
    async updateBankAccountStatus(
        id: string,
        bankAccountStatus: BankAccountStatus,
        additionalData?: Partial<Merchant>,
    ): Promise<Merchant | null> {
        const updateData: Partial<Merchant> = {
            bankAccountStatus,
            ...additionalData,
        };

        if (bankAccountStatus === BankAccountStatus.VERIFIED && !updateData.bankVerifiedAt) {
            updateData.bankVerifiedAt = new Date();
        }

        await this.repository.update(id, updateData as any);
        return this.findById(id);
    }

    /**
     * Increment API quota used
     */
    async incrementApiQuota(id: string): Promise<void> {
        await this.repository
            .createQueryBuilder()
            .update(Merchant)
            .set({ apiQuotaUsed: () => 'api_quota_used + 1' })
            .where('id = :id', { id })
            .execute();
    }

    /**
     * Reset API quota for merchants
     */
    async resetApiQuotas(): Promise<void> {
        await this.repository
            .createQueryBuilder()
            .update(Merchant)
            .set({
                apiQuotaUsed: 0,
                apiQuotaResetAt: new Date(),
            })
            .execute();
    }

    /**
     * Get merchant statistics
     */
    async getStatistics(): Promise<{
        total: number;
        active: number;
        pending: number;
        suspended: number;
        closed: number;
        kycPending: number;
        kycApproved: number;
        kycRejected: number;
    }> {
        const [
            total,
            active,
            pending,
            suspended,
            closed,
            kycPending,
            kycApproved,
            kycRejected,
        ] = await Promise.all([
            this.repository.count(),
            this.countByStatus(MerchantStatus.ACTIVE),
            this.countByStatus(MerchantStatus.PENDING),
            this.countByStatus(MerchantStatus.SUSPENDED),
            this.countByStatus(MerchantStatus.CLOSED),
            this.countByKycStatus(KycStatus.PENDING),
            this.countByKycStatus(KycStatus.APPROVED),
            this.countByKycStatus(KycStatus.REJECTED),
        ]);

        return {
            total,
            active,
            pending,
            suspended,
            closed,
            kycPending,
            kycApproved,
            kycRejected,
        };
    }

    /**
     * Find merchants with expired email verification tokens
     */
    async findExpiredVerificationTokens(): Promise<Merchant[]> {
        return this.repository
            .createQueryBuilder('merchant')
            .where('merchant.emailVerified = false')
            .andWhere('merchant.emailVerificationExpiresAt < :now', { now: new Date() })
            .andWhere('merchant.emailVerificationToken IS NOT NULL')
            .getMany();
    }

    /**
     * Bulk update merchants
     */
    async bulkUpdate(ids: string[], updateData: Partial<Merchant>): Promise<void> {
        if (ids.length > 0) {
            await this.repository.update(ids, updateData as any);
        }
    }
}
