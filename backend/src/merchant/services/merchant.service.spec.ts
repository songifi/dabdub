import { Test, TestingModule } from '@nestjs/testing';
import { MerchantService } from './merchant.service';
import { MerchantRepository } from '../repositories/merchant.repository';
import {
    Merchant,
    MerchantStatus,
    KycStatus,
    BankAccountStatus,
    BusinessType,
} from '../../database/entities/merchant.entity';
import {
    MerchantNotFoundException,
    MerchantAlreadyExistsException,
    MerchantSuspendedException,
    MerchantClosedException,
    MerchantEmailNotVerifiedException,
    MerchantEmailAlreadyVerifiedException,
    MerchantVerificationTokenInvalidException,
    MerchantVerificationTokenExpiredException,
    KycAlreadyApprovedException,
    KycAlreadySubmittedException,
    KycDocumentRequiredException,
    BankAccountNotFoundException,
    BankAccountAlreadyVerifiedException,
    ApiQuotaExceededException,
} from '../exceptions/merchant.exceptions';
import { IEmailService, IBankVerificationService } from '../interfaces/email-service.interface';

describe('MerchantService', () => {
    let service: MerchantService;
    let repository: jest.Mocked<MerchantRepository>;
    let emailService: jest.Mocked<IEmailService>;
    let bankVerificationService: jest.Mocked<IBankVerificationService>;

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

    const mockRepository = {
        create: jest.fn(),
        findById: jest.fn(),
        findByEmail: jest.fn(),
        findByVerificationToken: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        existsByEmail: jest.fn(),
        search: jest.fn(),
        updateStatus: jest.fn(),
        updateKycStatus: jest.fn(),
        updateBankAccountStatus: jest.fn(),
        incrementApiQuota: jest.fn(),
        resetApiQuotas: jest.fn(),
        getStatistics: jest.fn(),
        findExpiredVerificationTokens: jest.fn(),
    };

    const mockEmailService: jest.Mocked<IEmailService> = {
        sendVerificationEmail: jest.fn(),
        sendWelcomeEmail: jest.fn(),
        sendKycSubmittedEmail: jest.fn(),
        sendKycApprovedEmail: jest.fn(),
        sendKycRejectedEmail: jest.fn(),
        sendAccountSuspendedEmail: jest.fn(),
        sendAccountReactivatedEmail: jest.fn(),
        sendBankAccountVerifiedEmail: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
    };

    const mockBankVerificationService: jest.Mocked<IBankVerificationService> = {
        verifyBankAccount: jest.fn(),
        initiateMicroDeposits: jest.fn(),
        confirmMicroDeposits: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MerchantService,
                {
                    provide: MerchantRepository,
                    useValue: mockRepository,
                },
                {
                    provide: 'IEmailService',
                    useValue: mockEmailService,
                },
                {
                    provide: 'IBankVerificationService',
                    useValue: mockBankVerificationService,
                },
            ],
        }).compile();

        service = module.get<MerchantService>(MerchantService);
        repository = module.get(MerchantRepository);
        emailService = module.get('IEmailService');
        bankVerificationService = module.get('IBankVerificationService');
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('registerMerchant', () => {
        const registerDto = {
            name: 'Test Merchant',
            email: 'test@example.com',
            password: 'SecurePass123!',
            businessName: 'Test Business',
        };

        it('should register a new merchant successfully', async () => {
            mockRepository.findByEmail.mockResolvedValue(null);
            mockRepository.create.mockResolvedValue(mockMerchant as Merchant);

            const result = await service.registerMerchant(registerDto);

            expect(result).toBeDefined();
            expect(mockRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(mockRepository.create).toHaveBeenCalled();
            expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
        });

        it('should throw MerchantAlreadyExistsException if email exists', async () => {
            mockRepository.findByEmail.mockResolvedValue(mockMerchant as Merchant);

            await expect(service.registerMerchant(registerDto)).rejects.toThrow(
                MerchantAlreadyExistsException,
            );
        });
    });

    describe('verifyEmail', () => {
        it('should verify email successfully', async () => {
            const unverifiedMerchant = {
                ...mockMerchant,
                emailVerified: false,
                emailVerificationExpiresAt: new Date(Date.now() + 3600000),
            };
            const verifiedMerchant = { ...unverifiedMerchant, emailVerified: true };

            mockRepository.findByVerificationToken.mockResolvedValue(unverifiedMerchant as Merchant);
            mockRepository.update.mockResolvedValue(verifiedMerchant as Merchant);

            const result = await service.verifyEmail('valid-token');

            expect(result.emailVerified).toBe(true);
            expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalled();
        });

        it('should throw MerchantVerificationTokenInvalidException for invalid token', async () => {
            mockRepository.findByVerificationToken.mockResolvedValue(null);

            await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
                MerchantVerificationTokenInvalidException,
            );
        });

        it('should throw MerchantEmailAlreadyVerifiedException if already verified', async () => {
            const verifiedMerchant = { ...mockMerchant, emailVerified: true };
            mockRepository.findByVerificationToken.mockResolvedValue(verifiedMerchant as Merchant);

            await expect(service.verifyEmail('valid-token')).rejects.toThrow(
                MerchantEmailAlreadyVerifiedException,
            );
        });

        it('should throw MerchantVerificationTokenExpiredException for expired token', async () => {
            const expiredMerchant = {
                ...mockMerchant,
                emailVerified: false,
                emailVerificationExpiresAt: new Date(Date.now() - 3600000),
            };
            mockRepository.findByVerificationToken.mockResolvedValue(expiredMerchant as Merchant);

            await expect(service.verifyEmail('expired-token')).rejects.toThrow(
                MerchantVerificationTokenExpiredException,
            );
        });
    });

    describe('getMerchantById', () => {
        it('should return merchant when found', async () => {
            mockRepository.findById.mockResolvedValue(mockMerchant as Merchant);

            const result = await service.getMerchantById('test-merchant-id');

            expect(result).toEqual(mockMerchant);
        });

        it('should throw MerchantNotFoundException when not found', async () => {
            mockRepository.findById.mockResolvedValue(null);

            await expect(service.getMerchantById('non-existent-id')).rejects.toThrow(
                MerchantNotFoundException,
            );
        });
    });

    describe('updateProfile', () => {
        const updateDto = {
            name: 'Updated Name',
            businessName: 'Updated Business',
        };

        it('should update profile successfully', async () => {
            const activeMerchant = { ...mockMerchant, status: MerchantStatus.ACTIVE };
            const updatedMerchant = { ...activeMerchant, ...updateDto };

            mockRepository.findById.mockResolvedValue(activeMerchant as Merchant);
            mockRepository.update.mockResolvedValue(updatedMerchant as Merchant);

            const result = await service.updateProfile('test-merchant-id', updateDto);

            expect(result.name).toBe('Updated Name');
        });

        it('should throw MerchantSuspendedException for suspended merchant', async () => {
            const suspendedMerchant = {
                ...mockMerchant,
                status: MerchantStatus.SUSPENDED,
                suspensionReason: 'Violation',
            };
            mockRepository.findById.mockResolvedValue(suspendedMerchant as Merchant);

            await expect(service.updateProfile('test-merchant-id', updateDto)).rejects.toThrow(
                MerchantSuspendedException,
            );
        });

        it('should throw MerchantClosedException for closed merchant', async () => {
            const closedMerchant = { ...mockMerchant, status: MerchantStatus.CLOSED };
            mockRepository.findById.mockResolvedValue(closedMerchant as Merchant);

            await expect(service.updateProfile('test-merchant-id', updateDto)).rejects.toThrow(
                MerchantClosedException,
            );
        });
    });

    describe('submitKycDocuments', () => {
        const kycDto = {
            documents: [
                { type: 'government_id', fileName: 'id.pdf', fileUrl: 'https://example.com/id.pdf' },
                { type: 'proof_of_address', fileName: 'address.pdf', fileUrl: 'https://example.com/address.pdf' },
            ],
        };

        it('should submit KYC documents successfully', async () => {
            const verifiedMerchant = { ...mockMerchant, emailVerified: true };
            const updatedMerchant = { ...verifiedMerchant, kycStatus: KycStatus.PENDING };

            mockRepository.findById.mockResolvedValue(verifiedMerchant as Merchant);
            mockRepository.updateKycStatus.mockResolvedValue(updatedMerchant as Merchant);

            const result = await service.submitKycDocuments('test-merchant-id', kycDto);

            expect(result.kycStatus).toBe(KycStatus.PENDING);
            expect(mockEmailService.sendKycSubmittedEmail).toHaveBeenCalled();
        });

        it('should throw MerchantEmailNotVerifiedException if email not verified', async () => {
            mockRepository.findById.mockResolvedValue(mockMerchant as Merchant);

            await expect(service.submitKycDocuments('test-merchant-id', kycDto)).rejects.toThrow(
                MerchantEmailNotVerifiedException,
            );
        });

        it('should throw KycAlreadyApprovedException if KYC already approved', async () => {
            const approvedMerchant = {
                ...mockMerchant,
                emailVerified: true,
                kycStatus: KycStatus.APPROVED,
            };
            mockRepository.findById.mockResolvedValue(approvedMerchant as Merchant);

            await expect(service.submitKycDocuments('test-merchant-id', kycDto)).rejects.toThrow(
                KycAlreadyApprovedException,
            );
        });

        it('should throw KycDocumentRequiredException if required documents missing', async () => {
            const verifiedMerchant = { ...mockMerchant, emailVerified: true };
            mockRepository.findById.mockResolvedValue(verifiedMerchant as Merchant);

            const incompleteDto = {
                documents: [{ type: 'government_id', fileName: 'id.pdf', fileUrl: 'https://example.com/id.pdf' }],
            };

            await expect(service.submitKycDocuments('test-merchant-id', incompleteDto)).rejects.toThrow(
                KycDocumentRequiredException,
            );
        });
    });

    describe('verifyKyc', () => {
        it('should approve KYC successfully', async () => {
            const pendingMerchant = {
                ...mockMerchant,
                emailVerified: true,
                kycStatus: KycStatus.PENDING,
                status: MerchantStatus.ACTIVE,
            };
            const approvedMerchant = { ...pendingMerchant, kycStatus: KycStatus.APPROVED };

            // First call returns pending merchant, second call returns approved
            mockRepository.findById
                .mockResolvedValueOnce(pendingMerchant as Merchant)
                .mockResolvedValueOnce(approvedMerchant as Merchant);
            mockRepository.updateKycStatus.mockResolvedValue(approvedMerchant as Merchant);

            const result = await service.verifyKyc('test-merchant-id', { decision: 'approved' });

            expect(result.kycStatus).toBe(KycStatus.APPROVED);
            expect(mockEmailService.sendKycApprovedEmail).toHaveBeenCalled();
        });

        it('should reject KYC with reason', async () => {
            // Clear previous mocks
            mockRepository.findById.mockReset();

            const pendingMerchant = {
                ...mockMerchant,
                emailVerified: true,
                kycStatus: KycStatus.PENDING,
                status: MerchantStatus.ACTIVE,
            };
            const rejectedMerchant = { ...pendingMerchant, kycStatus: KycStatus.REJECTED };

            mockRepository.findById.mockResolvedValue(pendingMerchant as Merchant);
            mockRepository.updateKycStatus.mockResolvedValue(rejectedMerchant as Merchant);

            const result = await service.verifyKyc('test-merchant-id', {
                decision: 'rejected',
                rejectionReason: 'Document unclear',
            });

            expect(result.kycStatus).toBe(KycStatus.REJECTED);
            expect(mockEmailService.sendKycRejectedEmail).toHaveBeenCalled();
        });
    });

    describe('updateBankAccount', () => {
        const bankDto = {
            accountNumber: '1234567890',
            routingNumber: '021000021',
            accountHolderName: 'Test Merchant',
            bankName: 'Test Bank',
        };

        it('should update bank account successfully', async () => {
            const activeMerchant = { ...mockMerchant, status: MerchantStatus.ACTIVE };
            const updatedMerchant = {
                ...activeMerchant,
                bankAccountNumber: bankDto.accountNumber,
                bankAccountStatus: BankAccountStatus.PENDING,
            };

            mockRepository.findById.mockResolvedValue(activeMerchant as Merchant);
            mockRepository.update.mockResolvedValue(updatedMerchant as Merchant);

            const result = await service.updateBankAccount('test-merchant-id', bankDto);

            expect(result.bankAccountStatus).toBe(BankAccountStatus.PENDING);
        });
    });

    describe('verifyBankAccount', () => {
        it('should verify bank account successfully', async () => {
            const merchantWithBank = {
                ...mockMerchant,
                status: MerchantStatus.ACTIVE,
                bankAccountNumber: '1234567890',
                bankRoutingNumber: '021000021',
                bankAccountHolderName: 'Test Merchant',
                bankAccountStatus: BankAccountStatus.PENDING,
            };
            const verifiedMerchant = { ...merchantWithBank, bankAccountStatus: BankAccountStatus.VERIFIED };

            mockRepository.findById.mockResolvedValue(merchantWithBank as Merchant);
            mockBankVerificationService.verifyBankAccount.mockResolvedValue({ success: true });
            mockRepository.updateBankAccountStatus.mockResolvedValue(verifiedMerchant as Merchant);

            const result = await service.verifyBankAccount('test-merchant-id');

            expect(result.bankAccountStatus).toBe(BankAccountStatus.VERIFIED);
            expect(mockEmailService.sendBankAccountVerifiedEmail).toHaveBeenCalled();
        });

        it('should throw BankAccountNotFoundException if no bank account', async () => {
            mockRepository.findById.mockResolvedValue(mockMerchant as Merchant);

            await expect(service.verifyBankAccount('test-merchant-id')).rejects.toThrow(
                BankAccountNotFoundException,
            );
        });

        it('should throw BankAccountAlreadyVerifiedException if already verified', async () => {
            const verifiedMerchant = {
                ...mockMerchant,
                bankAccountNumber: '1234567890',
                bankRoutingNumber: '021000021',
                bankAccountStatus: BankAccountStatus.VERIFIED,
            };
            mockRepository.findById.mockResolvedValue(verifiedMerchant as Merchant);

            await expect(service.verifyBankAccount('test-merchant-id')).rejects.toThrow(
                BankAccountAlreadyVerifiedException,
            );
        });
    });

    describe('changeMerchantStatus', () => {
        it('should activate merchant from pending status', async () => {
            const pendingMerchant = { ...mockMerchant, status: MerchantStatus.PENDING };
            const activeMerchant = { ...pendingMerchant, status: MerchantStatus.ACTIVE };

            mockRepository.findById.mockResolvedValue(pendingMerchant as Merchant);
            mockRepository.updateStatus.mockResolvedValue(activeMerchant as Merchant);

            const result = await service.activateMerchant('test-merchant-id');

            expect(result.status).toBe(MerchantStatus.ACTIVE);
        });

        it('should suspend merchant with reason', async () => {
            const activeMerchant = { ...mockMerchant, status: MerchantStatus.ACTIVE };
            const suspendedMerchant = { ...activeMerchant, status: MerchantStatus.SUSPENDED };

            mockRepository.findById.mockResolvedValue(activeMerchant as Merchant);
            mockRepository.updateStatus.mockResolvedValue(suspendedMerchant as Merchant);

            const result = await service.suspendMerchant('test-merchant-id', 'Violation of terms');

            expect(result.status).toBe(MerchantStatus.SUSPENDED);
            expect(mockEmailService.sendAccountSuspendedEmail).toHaveBeenCalled();
        });
    });

    describe('searchMerchants', () => {
        it('should search merchants with pagination', async () => {
            const merchants = [mockMerchant as Merchant];
            mockRepository.search.mockResolvedValue({ data: merchants, total: 1 });

            const result = await service.searchMerchants({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.totalPages).toBe(1);
        });
    });

    describe('checkAndIncrementApiQuota', () => {
        it('should increment quota when not exceeded', async () => {
            mockRepository.findById.mockResolvedValue(mockMerchant as Merchant);

            await expect(service.checkAndIncrementApiQuota('test-merchant-id')).resolves.not.toThrow();
            expect(mockRepository.incrementApiQuota).toHaveBeenCalledWith('test-merchant-id');
        });

        it('should throw ApiQuotaExceededException when quota exceeded', async () => {
            const exceededMerchant = { ...mockMerchant, apiQuotaUsed: 1000, apiQuotaLimit: 1000 };
            mockRepository.findById.mockResolvedValue(exceededMerchant as Merchant);

            await expect(service.checkAndIncrementApiQuota('test-merchant-id')).rejects.toThrow(
                ApiQuotaExceededException,
            );
        });
    });

    describe('getMerchantAnalytics', () => {
        it('should return analytics data', async () => {
            mockRepository.findById.mockResolvedValue(mockMerchant as Merchant);

            const result = await service.getMerchantAnalytics('test-merchant-id');

            expect(result).toBeDefined();
            expect(result.apiQuotaLimit).toBe(1000);
            expect(result.apiQuotaUsed).toBe(0);
        });
    });

    describe('getMerchantStatistics', () => {
        it('should return merchant statistics', async () => {
            const stats = {
                total: 100,
                active: 70,
                pending: 15,
                suspended: 10,
                closed: 5,
                kycPending: 20,
                kycApproved: 60,
                kycRejected: 10,
            };
            mockRepository.getStatistics.mockResolvedValue(stats);

            const result = await service.getMerchantStatistics();

            expect(result).toEqual(stats);
        });
    });
});
