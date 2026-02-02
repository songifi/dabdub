import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { MerchantService } from './services/merchant.service';
import {
    RegisterMerchantDto,
    UpdateMerchantProfileDto,
    UpdateBusinessDetailsDto,
    AddressDto,
    BankAccountDto,
    SubmitKycDto,
    VerifyKycDto,
    SettlementPreferencesDto,
    NotificationPreferencesDto,
    CurrencySettingsDto,
    SearchMerchantsDto,
    UpdateApiQuotaDto,
    ChangeMerchantStatusDto,
    VerifyEmailDto,
    ResendVerificationDto,
    MerchantResponseDto,
    MerchantAnalyticsDto,
    PaginatedMerchantsDto,
} from './dto/merchant.dto';

/**
 * Controller for merchant registration and management
 */
@ApiTags('Merchants')
@Controller('merchants')
export class MerchantController {
    constructor(private readonly merchantService: MerchantService) {}

    /**
     * Register a new merchant
     */
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register a new merchant' })
    @ApiResponse({ status: 201, description: 'Merchant registered successfully', type: MerchantResponseDto })
    @ApiResponse({ status: 409, description: 'Merchant with this email already exists' })
    async register(@Body() dto: RegisterMerchantDto): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.registerMerchant(dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Verify email address
     */
    @Post('verify-email')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify merchant email address' })
    @ApiResponse({ status: 200, description: 'Email verified successfully', type: MerchantResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid or expired verification token' })
    async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.verifyEmail(dto.token);
        return this.toResponseDto(merchant);
    }

    /**
     * Resend verification email
     */
    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resend email verification' })
    @ApiResponse({ status: 200, description: 'Verification email sent' })
    @ApiResponse({ status: 400, description: 'Email already verified' })
    @ApiResponse({ status: 404, description: 'Merchant not found' })
    async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ message: string }> {
        await this.merchantService.resendVerificationEmail(dto.email);
        return { message: 'Verification email sent successfully' };
    }

    /**
     * Get merchant by ID
     */
    @Get(':id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get merchant by ID' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Merchant found', type: MerchantResponseDto })
    @ApiResponse({ status: 404, description: 'Merchant not found' })
    async getMerchant(@Param('id') id: string): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.getMerchantById(id);
        return this.toResponseDto(merchant);
    }

    /**
     * Update merchant profile
     */
    @Put(':id/profile')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update merchant profile' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Profile updated', type: MerchantResponseDto })
    @ApiResponse({ status: 404, description: 'Merchant not found' })
    async updateProfile(
        @Param('id') id: string,
        @Body() dto: UpdateMerchantProfileDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.updateProfile(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Update business details
     */
    @Put(':id/business-details')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update business details' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Business details updated', type: MerchantResponseDto })
    @ApiResponse({ status: 404, description: 'Merchant not found' })
    async updateBusinessDetails(
        @Param('id') id: string,
        @Body() dto: UpdateBusinessDetailsDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.updateBusinessDetails(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Update merchant address
     */
    @Put(':id/address')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update merchant address' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Address updated', type: MerchantResponseDto })
    @ApiResponse({ status: 404, description: 'Merchant not found' })
    async updateAddress(
        @Param('id') id: string,
        @Body() dto: AddressDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.updateAddress(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Submit KYC documents
     */
    @Post(':id/kyc')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit KYC documents' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'KYC documents submitted', type: MerchantResponseDto })
    @ApiResponse({ status: 400, description: 'KYC already submitted or missing documents' })
    @ApiResponse({ status: 403, description: 'Email not verified' })
    async submitKyc(
        @Param('id') id: string,
        @Body() dto: SubmitKycDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.submitKycDocuments(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Verify KYC (admin action)
     */
    @Post(':id/kyc/verify')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify KYC documents (Admin)' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'KYC verification completed', type: MerchantResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid KYC status' })
    async verifyKyc(
        @Param('id') id: string,
        @Body() dto: VerifyKycDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.verifyKyc(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Update bank account details
     */
    @Put(':id/bank-account')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update bank account details' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Bank account updated', type: MerchantResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid bank account details' })
    async updateBankAccount(
        @Param('id') id: string,
        @Body() dto: BankAccountDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.updateBankAccount(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Verify bank account
     */
    @Post(':id/bank-account/verify')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify bank account' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Bank account verified', type: MerchantResponseDto })
    @ApiResponse({ status: 400, description: 'Verification failed' })
    async verifyBankAccount(@Param('id') id: string): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.verifyBankAccount(id);
        return this.toResponseDto(merchant);
    }

    /**
     * Update settlement preferences
     */
    @Put(':id/settlement-preferences')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update settlement preferences' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Settlement preferences updated', type: MerchantResponseDto })
    async updateSettlementPreferences(
        @Param('id') id: string,
        @Body() dto: SettlementPreferencesDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.updateSettlementPreferences(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Update notification preferences
     */
    @Put(':id/notification-preferences')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update notification preferences' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Notification preferences updated', type: MerchantResponseDto })
    async updateNotificationPreferences(
        @Param('id') id: string,
        @Body() dto: NotificationPreferencesDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.updateNotificationPreferences(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Update currency settings
     */
    @Put(':id/currency-settings')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update currency settings' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Currency settings updated', type: MerchantResponseDto })
    async updateCurrencySettings(
        @Param('id') id: string,
        @Body() dto: CurrencySettingsDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.updateCurrencySettings(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Get merchant analytics
     */
    @Get(':id/analytics')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get merchant analytics' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Analytics data', type: MerchantAnalyticsDto })
    async getAnalytics(@Param('id') id: string): Promise<MerchantAnalyticsDto> {
        return this.merchantService.getMerchantAnalytics(id);
    }

    /**
     * Change merchant status (admin action)
     */
    @Patch(':id/status')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Change merchant status (Admin)' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Status changed', type: MerchantResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid status transition' })
    async changeStatus(
        @Param('id') id: string,
        @Body() dto: ChangeMerchantStatusDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.changeMerchantStatus(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Activate merchant (admin action)
     */
    @Post(':id/activate')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Activate merchant (Admin)' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Merchant activated', type: MerchantResponseDto })
    async activate(@Param('id') id: string): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.activateMerchant(id);
        return this.toResponseDto(merchant);
    }

    /**
     * Suspend merchant (admin action)
     */
    @Post(':id/suspend')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Suspend merchant (Admin)' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Merchant suspended', type: MerchantResponseDto })
    async suspend(
        @Param('id') id: string,
        @Body() body: { reason?: string },
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.suspendMerchant(id, body.reason);
        return this.toResponseDto(merchant);
    }

    /**
     * Close merchant account (admin action)
     */
    @Post(':id/close')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Close merchant account (Admin)' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'Account closed', type: MerchantResponseDto })
    async closeAccount(
        @Param('id') id: string,
        @Body() body: { reason?: string },
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.closeMerchantAccount(id, body.reason);
        return this.toResponseDto(merchant);
    }

    /**
     * Update API quota (admin action)
     */
    @Patch(':id/api-quota')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update API quota (Admin)' })
    @ApiParam({ name: 'id', description: 'Merchant ID' })
    @ApiResponse({ status: 200, description: 'API quota updated', type: MerchantResponseDto })
    async updateApiQuota(
        @Param('id') id: string,
        @Body() dto: UpdateApiQuotaDto,
    ): Promise<MerchantResponseDto> {
        const merchant = await this.merchantService.updateApiQuota(id, dto);
        return this.toResponseDto(merchant);
    }

    /**
     * Search merchants (admin action)
     */
    @Get()
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Search and filter merchants (Admin)' })
    @ApiResponse({ status: 200, description: 'Paginated merchant list', type: PaginatedMerchantsDto })
    async searchMerchants(@Query() dto: SearchMerchantsDto): Promise<PaginatedMerchantsDto> {
        const result = await this.merchantService.searchMerchants(dto);
        return {
            data: result.data.map(m => this.toResponseDto(m)),
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
        };
    }

    /**
     * Get merchant statistics (admin action)
     */
    @Get('admin/statistics')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get merchant statistics (Admin)' })
    @ApiResponse({ status: 200, description: 'Merchant statistics' })
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
        return this.merchantService.getMerchantStatistics();
    }

    /**
     * Convert merchant entity to response DTO
     */
    private toResponseDto(merchant: any): MerchantResponseDto {
        return {
            id: merchant.id,
            name: merchant.name,
            businessName: merchant.businessName,
            email: merchant.email,
            phone: merchant.phone,
            website: merchant.website,
            businessType: merchant.businessType,
            status: merchant.status,
            kycStatus: merchant.kycStatus,
            emailVerified: merchant.emailVerified,
            bankAccountStatus: merchant.bankAccountStatus,
            supportedCurrencies: merchant.supportedCurrencies,
            defaultCurrency: merchant.defaultCurrency,
            createdAt: merchant.createdAt,
            updatedAt: merchant.updatedAt,
        };
    }
}
