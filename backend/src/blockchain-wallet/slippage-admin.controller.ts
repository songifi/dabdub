import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SlippageService } from './slippage.service';

export class SetMaxSlippageDto {
  @IsInt()
  @Min(0)
  @Max(10_000)
  maxSlippageBps: number;
}

@ApiTags('Admin - Slippage')
@UseGuards(AdminGuard)
@Controller('admin/slippage')
export class SlippageAdminController {
  constructor(private readonly slippageService: SlippageService) {}

  @Get()
  @ApiOperation({ summary: 'Get current max slippage tolerance (bps)' })
  async get(): Promise<{ maxSlippageBps: number }> {
    const maxSlippageBps = await this.slippageService.getMaxSlippageBps();
    return { maxSlippageBps };
  }

  @Put()
  @ApiOperation({ summary: 'Update max slippage tolerance (bps). 100 = 1%.' })
  async set(@Body() dto: SetMaxSlippageDto): Promise<{ maxSlippageBps: number }> {
    await this.slippageService.setMaxSlippage(dto.maxSlippageBps);
    return { maxSlippageBps: dto.maxSlippageBps };
  }
}
