import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { SettlementGenericFilterDto } from './dto/settlement-filter.dto';
import { SettlementPreferencesDto } from './dto/settlement-preferences.dto';
import { BatchSettlementDto } from './dto/batch-settlement.dto';
import {
  SettlementResponseDto,
  SettlementStatsDto,
} from './dto/settlement-response.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MerchantAuthGuard } from '../merchant/guards/merchant-auth.guard';
import { CommonResponseDto } from '../common/dto/common-response.dto';

@ApiTags('Settlements')
@ApiBearerAuth()
@Controller('api/v1/settlements')
@UseGuards(ThrottlerGuard, MerchantAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settlements with filtering' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of settlements',
    type: SettlementResponseDto, // Swagger might need array wrapper or custom response
  })
  async findAll(
    @Req() req: any,
    @Query() filter: SettlementGenericFilterDto,
  ): Promise<CommonResponseDto<any>> {
    // Using any for pagination wrapper for now or define PaginationResponse
    const result = await this.settlementService.findAll(req.user.id, filter);
    return {
      success: true,
      data: result,
      message: 'Settlements retrieved successfully',
    };
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending settlements' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of pending settlements',
    type: [SettlementResponseDto],
  })
  async findPending(
    @Req() req: any,
  ): Promise<CommonResponseDto<SettlementResponseDto[]>> {
    const result = await this.settlementService.findPending(req.user.id);
    return {
      success: true,
      data: result as any, // Cast to any to avoid strict type checks on entities vs DTOs
      message: 'Pending settlements retrieved successfully',
    };
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get settlement statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Settlement statistics',
    type: SettlementStatsDto,
  })
  async getStatistics(
    @Req() req: any,
  ): Promise<CommonResponseDto<SettlementStatsDto>> {
    const result = await this.settlementService.getStatistics(req.user.id);
    return {
      success: true,
      data: result,
      message: 'Statistics retrieved successfully',
    };
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get settlement schedule' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Settlement schedule preference',
  })
  async getSchedule(@Req() req: any): Promise<CommonResponseDto<any>> {
    const result = await this.settlementService.getSchedule(req.user.id);
    return {
      success: true,
      data: result,
      message: 'Schedule retrieved successfully',
    };
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update settlement preferences' })
  @ApiBody({ type: SettlementPreferencesDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated successfully',
  })
  async updatePreferences(
    @Req() req: any,
    @Body() preferences: SettlementPreferencesDto,
  ): Promise<CommonResponseDto<any>> {
    const result = await this.settlementService.updatePreferences(
      req.user.id,
      preferences,
    );
    return {
      success: true,
      data: result,
      message: 'Preferences updated successfully',
    };
  }

  @Post('batch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create manual batch settlement' })
  @ApiBody({ type: BatchSettlementDto })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Batch settlement triggered',
  })
  async createBatch(
    @Req() req: any,
    @Body() batchDto: BatchSettlementDto,
  ): Promise<CommonResponseDto<void>> {
    await this.settlementService.createBatch(req.user.id, batchDto);
    return {
      success: true,
      message: 'Batch settlement processing initiated',
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get settlement history' })
  async getHistory(
    @Req() req: any,
    @Query() filter: SettlementGenericFilterDto,
  ): Promise<CommonResponseDto<any>> {
    // Logic same as findAll but maybe restricted to non-pending?
    // For now implemented as alias to findAll
    const result = await this.settlementService.getHistory(req.user.id, filter);
    return {
      success: true,
      data: result,
      message: 'Settlement history retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get settlement details' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Settlement details',
    type: SettlementResponseDto,
  })
  async findOne(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CommonResponseDto<SettlementResponseDto>> {
    const result = await this.settlementService.findOne(id, req.user.id);
    return {
      success: true,
      data: result as any,
      message: 'Settlement details retrieved successfully',
    };
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Get settlement receipt' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Settlement receipt',
  })
  async getReceipt(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CommonResponseDto<any>> {
    const result = await this.settlementService.generateReceipt(
      id,
      req.user.id,
    );
    return {
      success: true,
      data: result,
      message: 'Receipt generated successfully',
    };
  }
}
