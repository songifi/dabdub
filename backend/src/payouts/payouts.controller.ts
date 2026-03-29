import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { ScheduledPayout } from './entities/scheduled-payout.entity';

@ApiTags('payouts')
@ApiBearerAuth()
@Controller({ path: 'payouts', version: '1' })
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scheduled payout' })
  @ApiResponse({ status: 201, description: 'Scheduled payout created successfully.' })
  async create(
    @Req() req: any,
    @Body() dto: CreatePayoutDto,
  ): Promise<ScheduledPayout> {
    return this.payoutsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all scheduled payouts for the current user' })
  async findAll(@Req() req: any): Promise<ScheduledPayout[]> {
    return this.payoutsService.findAll(req.user.id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause an active scheduled payout' })
  async pause(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<ScheduledPayout> {
    return this.payoutsService.pause(req.user.id, id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused scheduled payout' })
  async resume(
    @Req() req: any,
    @Param('id') id: string,
    @Body('pin') pin: string,
  ): Promise<ScheduledPayout> {
    return this.payoutsService.resume(req.user.id, id, pin);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel/Delete a scheduled payout' })
  async cancel(@Req() req: any, @Param('id') id: string): Promise<void> {
    return this.payoutsService.cancel(req.user.id, id);
  }
}
