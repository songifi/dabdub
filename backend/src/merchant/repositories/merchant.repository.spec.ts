import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantRepository } from './merchant.repository';
import {
    Merchant,
    MerchantStatus,
    KycStatus,
    BankAccountStatus,
} from '../../database/entities/merchant.entity';

describe('MerchantRepository', () => {
    let repository: MerchantRepository;
    let typeormRepository: jest.Mocked<Repository<Merchant>>;

    const mockMerchant: Partial<Merchant> = {
        id: 'test-merchant-id',
        name: 'Test Merchant',
        email: 'test@example.com',
        businessName: 'Test Business',
        status: MerchantStatus.PENDING,
        kycStatus: KycStatus.NOT_STARTED,
        emailVerified: false,
        bankAccountStatus: BankAccountStatus.NOT_VERIFIED,
        supportedCurrencies: ['USD'],
        defaultCurrency: 'USD',
        apiQuotaLimit: 1000,
        apiQuotaUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
        getManyAndCount: jest.fn(),
        getCount: jest.fn(),
        clone: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(),
    };

    const mockTypeormRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findAndCount: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MerchantRepository,
                {
                    provide: getRepositoryToken(Merchant),
                    useValue: mockTypeormRepository,
                },
            ],
        }).compile();

        repository = module.get<MerchantRepository>(MerchantRepository);
        typeormRepository = module.get(getRepositoryToken(Merchant));
    });

    it('should be defined', () => {
        expect(repository).toBeDefined();
    });

    describe('create', () => {
        it('should create and save a merchant', async () => {
            mockTypeormRepository.create.mockReturnValue(mockMerchant);
            mockTypeormRepository.save.mockResolvedValue(mockMerchant);

            const result = await repository.create(mockMerchant);

            expect(mockTypeormRepository.create).toHaveBeenCalledWith(mockMerchant);
            expect(mockTypeormRepository.save).toHaveBeenCalled();
            expect(result).toEqual(mockMerchant);
        });
    });

    describe('findById', () => {
        it('should find merchant by id', async () => {
            mockTypeormRepository.findOne.mockResolvedValue(mockMerchant as Merchant);

            const result = await repository.findById('test-merchant-id');

            expect(mockTypeormRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'test-merchant-id' },
            });
            expect(result).toEqual(mockMerchant);
        });

        it('should return null if not found', async () => {
            mockTypeormRepository.findOne.mockResolvedValue(null);

            const result = await repository.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findByEmail', () => {
        it('should find merchant by email (lowercase)', async () => {
            mockTypeormRepository.findOne.mockResolvedValue(mockMerchant as Merchant);

            const result = await repository.findByEmail('TEST@EXAMPLE.COM');

            expect(mockTypeormRepository.findOne).toHaveBeenCalledWith({
                where: { email: 'test@example.com' },
            });
            expect(result).toEqual(mockMerchant);
        });
    });

    describe('findByVerificationToken', () => {
        it('should find merchant by verification token', async () => {
            mockTypeormRepository.findOne.mockResolvedValue(mockMerchant as Merchant);

            const result = await repository.findByVerificationToken('test-token');

            expect(mockTypeormRepository.findOne).toHaveBeenCalledWith({
                where: { emailVerificationToken: 'test-token' },
            });
            expect(result).toEqual(mockMerchant);
        });
    });

    describe('update', () => {
        it('should update and return merchant', async () => {
            const updatedMerchant = { ...mockMerchant, name: 'Updated Name' };
            mockTypeormRepository.update.mockResolvedValue({ affected: 1 });
            mockTypeormRepository.findOne.mockResolvedValue(updatedMerchant as Merchant);

            const result = await repository.update('test-merchant-id', { name: 'Updated Name' });

            expect(mockTypeormRepository.update).toHaveBeenCalledWith('test-merchant-id', { name: 'Updated Name' });
            expect(result).toEqual(updatedMerchant);
        });
    });

    describe('existsByEmail', () => {
        it('should return true if email exists', async () => {
            mockTypeormRepository.count.mockResolvedValue(1);

            const result = await repository.existsByEmail('test@example.com');

            expect(result).toBe(true);
        });

        it('should return false if email does not exist', async () => {
            mockTypeormRepository.count.mockResolvedValue(0);

            const result = await repository.existsByEmail('nonexistent@example.com');

            expect(result).toBe(false);
        });
    });

    describe('findByStatus', () => {
        it('should find merchants by status', async () => {
            const merchants = [mockMerchant as Merchant];
            mockTypeormRepository.find.mockResolvedValue(merchants);

            const result = await repository.findByStatus(MerchantStatus.PENDING);

            expect(mockTypeormRepository.find).toHaveBeenCalledWith({
                where: { status: MerchantStatus.PENDING },
            });
            expect(result).toEqual(merchants);
        });
    });

    describe('findByKycStatus', () => {
        it('should find merchants by KYC status', async () => {
            const merchants = [mockMerchant as Merchant];
            mockTypeormRepository.find.mockResolvedValue(merchants);

            const result = await repository.findByKycStatus(KycStatus.PENDING);

            expect(mockTypeormRepository.find).toHaveBeenCalledWith({
                where: { kycStatus: KycStatus.PENDING },
            });
            expect(result).toEqual(merchants);
        });
    });

    describe('search', () => {
        it('should search merchants with filters and pagination', async () => {
            const merchants = [mockMerchant as Merchant];
            mockQueryBuilder.getManyAndCount.mockResolvedValue([merchants, 1]);

            const result = await repository.search({
                search: 'test',
                status: MerchantStatus.PENDING,
                page: 1,
                limit: 20,
            });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
            expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
            expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
            expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
            expect(result.data).toEqual(merchants);
            expect(result.total).toBe(1);
        });
    });

    describe('countByStatus', () => {
        it('should count merchants by status', async () => {
            mockTypeormRepository.count.mockResolvedValue(5);

            const result = await repository.countByStatus(MerchantStatus.ACTIVE);

            expect(mockTypeormRepository.count).toHaveBeenCalledWith({
                where: { status: MerchantStatus.ACTIVE },
            });
            expect(result).toBe(5);
        });
    });

    describe('updateStatus', () => {
        it('should update status and return merchant', async () => {
            const updatedMerchant = { ...mockMerchant, status: MerchantStatus.ACTIVE };
            mockTypeormRepository.update.mockResolvedValue({ affected: 1 });
            mockTypeormRepository.findOne.mockResolvedValue(updatedMerchant as Merchant);

            const result = await repository.updateStatus('test-merchant-id', MerchantStatus.ACTIVE);

            expect(mockTypeormRepository.update).toHaveBeenCalled();
            expect(result?.status).toBe(MerchantStatus.ACTIVE);
        });

        it('should set closedAt when status is CLOSED', async () => {
            const closedMerchant = { ...mockMerchant, status: MerchantStatus.CLOSED };
            mockTypeormRepository.update.mockResolvedValue({ affected: 1 });
            mockTypeormRepository.findOne.mockResolvedValue(closedMerchant as Merchant);

            await repository.updateStatus('test-merchant-id', MerchantStatus.CLOSED);

            expect(mockTypeormRepository.update).toHaveBeenCalledWith(
                'test-merchant-id',
                expect.objectContaining({
                    status: MerchantStatus.CLOSED,
                    closedAt: expect.any(Date),
                }),
            );
        });
    });

    describe('updateKycStatus', () => {
        it('should update KYC status and return merchant', async () => {
            const updatedMerchant = { ...mockMerchant, kycStatus: KycStatus.APPROVED };
            mockTypeormRepository.update.mockResolvedValue({ affected: 1 });
            mockTypeormRepository.findOne.mockResolvedValue(updatedMerchant as Merchant);

            const result = await repository.updateKycStatus('test-merchant-id', KycStatus.APPROVED);

            expect(result?.kycStatus).toBe(KycStatus.APPROVED);
        });

        it('should set kycVerifiedAt when status is APPROVED', async () => {
            const approvedMerchant = { ...mockMerchant, kycStatus: KycStatus.APPROVED };
            mockTypeormRepository.update.mockResolvedValue({ affected: 1 });
            mockTypeormRepository.findOne.mockResolvedValue(approvedMerchant as Merchant);

            await repository.updateKycStatus('test-merchant-id', KycStatus.APPROVED);

            expect(mockTypeormRepository.update).toHaveBeenCalledWith(
                'test-merchant-id',
                expect.objectContaining({
                    kycStatus: KycStatus.APPROVED,
                    kycVerifiedAt: expect.any(Date),
                }),
            );
        });
    });

    describe('updateBankAccountStatus', () => {
        it('should update bank account status and return merchant', async () => {
            const updatedMerchant = { ...mockMerchant, bankAccountStatus: BankAccountStatus.VERIFIED };
            mockTypeormRepository.update.mockResolvedValue({ affected: 1 });
            mockTypeormRepository.findOne.mockResolvedValue(updatedMerchant as Merchant);

            const result = await repository.updateBankAccountStatus(
                'test-merchant-id',
                BankAccountStatus.VERIFIED,
            );

            expect(result?.bankAccountStatus).toBe(BankAccountStatus.VERIFIED);
        });

        it('should set bankVerifiedAt when status is VERIFIED', async () => {
            const verifiedMerchant = { ...mockMerchant, bankAccountStatus: BankAccountStatus.VERIFIED };
            mockTypeormRepository.update.mockResolvedValue({ affected: 1 });
            mockTypeormRepository.findOne.mockResolvedValue(verifiedMerchant as Merchant);

            await repository.updateBankAccountStatus('test-merchant-id', BankAccountStatus.VERIFIED);

            expect(mockTypeormRepository.update).toHaveBeenCalledWith(
                'test-merchant-id',
                expect.objectContaining({
                    bankAccountStatus: BankAccountStatus.VERIFIED,
                    bankVerifiedAt: expect.any(Date),
                }),
            );
        });
    });

    describe('incrementApiQuota', () => {
        it('should increment API quota', async () => {
            mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

            await repository.incrementApiQuota('test-merchant-id');

            expect(mockTypeormRepository.createQueryBuilder).toHaveBeenCalled();
            expect(mockQueryBuilder.update).toHaveBeenCalled();
        });
    });

    describe('resetApiQuotas', () => {
        it('should reset API quotas for all merchants', async () => {
            mockQueryBuilder.execute.mockResolvedValue({ affected: 10 });

            await repository.resetApiQuotas();

            expect(mockQueryBuilder.set).toHaveBeenCalledWith({
                apiQuotaUsed: 0,
                apiQuotaResetAt: expect.any(Date),
            });
        });
    });

    describe('getStatistics', () => {
        it('should return merchant statistics', async () => {
            mockTypeormRepository.count.mockResolvedValue(10);

            const result = await repository.getStatistics();

            expect(result).toBeDefined();
            expect(result.total).toBeDefined();
        });
    });

    describe('delete', () => {
        it('should delete merchant by id', async () => {
            mockTypeormRepository.delete.mockResolvedValue({ affected: 1 });

            await repository.delete('test-merchant-id');

            expect(mockTypeormRepository.delete).toHaveBeenCalledWith('test-merchant-id');
        });
    });

    describe('bulkUpdate', () => {
        it('should update multiple merchants', async () => {
            mockTypeormRepository.update.mockResolvedValue({ affected: 2 });

            await repository.bulkUpdate(['id1', 'id2'], { status: MerchantStatus.ACTIVE });

            expect(mockTypeormRepository.update).toHaveBeenCalledWith(
                ['id1', 'id2'],
                { status: MerchantStatus.ACTIVE },
            );
        });

        it('should not call update if ids array is empty', async () => {
            await repository.bulkUpdate([], { status: MerchantStatus.ACTIVE });

            expect(mockTypeormRepository.update).not.toHaveBeenCalled();
        });
    });
});
