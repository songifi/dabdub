import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { SettlementRepository } from './repositories/settlement.repository';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@Controller('settlements')
export class SettlementController {
    constructor(
        private readonly settlementService: SettlementService,
        private readonly settlementRepository: SettlementRepository,
    ) { }

    @Post('create')
    async createSettlement(@Body() data: CreateSettlementDto) {
        return this.settlementService.createSettlement(data);
    }

    @Post('process-batch')
    async triggerBatchProcessing() {
        await this.settlementService.processSettlements();
        return { message: 'Batch processing triggered' };
    }

    @Get('stats/:merchantId')
    async getStats(@Param('merchantId') merchantId: string) {
        return this.settlementRepository.getSettlementStats(merchantId);
    }

    @Get()
    async getSettlements(@Query('merchantId') merchantId: string) {
        if (!merchantId) {
            return [];
        }
        return this.settlementRepository.findByMerchantId(merchantId);
    }
}
