import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalQueryDto } from './dto/withdrawal-query.dto';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'withdrawals', version: '1' })
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.create(req.user.id, dto);
  }

  @Get()
  findAll(
    @Req() req: { user: { id: string } },
    @Query() query: WithdrawalQueryDto,
  ) {
    return this.withdrawalsService.findAll(req.user.id, query);
  }

  @Get(':id')
  findOne(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.withdrawalsService.findOne(req.user.id, id);
  }
}
