import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OffRampService } from './offramp.service';
import {
  ExecuteOffRampDto,
  OffRampHistoryQueryDto,
  OffRampPreviewResponseDto,
  OffRampResponseDto,
  PreviewOffRampDto,
} from './dto/offramp.dto';

@ApiTags('Off-Ramp')
@UseGuards(JwtAuthGuard)
@Controller('offramp')
export class OffRampController {
  constructor(private readonly offRampService: OffRampService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Preview off-ramp: get NGN amount at current rate' })
  preview(
    @Body() dto: PreviewOffRampDto,
    @Req() req: any,
  ): Promise<OffRampPreviewResponseDto> {
    return this.offRampService.preview(req.user.id, dto);
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute off-ramp: convert USDC to NGN and send to bank' })
  execute(
    @Body() dto: ExecuteOffRampDto,
    @Req() req: any,
  ): Promise<OffRampResponseDto> {
    return this.offRampService.execute(req.user.id, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get paginated off-ramp history' })
  history(
    @Query() query: OffRampHistoryQueryDto,
    @Req() req: any,
  ) {
    return this.offRampService.getHistory(req.user.id, query.page, query.limit);
  }

  @Get(':referenceId/status')
  @ApiOperation({ summary: 'Poll status of a specific off-ramp' })
  status(
    @Param('referenceId') referenceId: string,
    @Req() req: any,
  ): Promise<OffRampResponseDto> {
    return this.offRampService.getStatus(req.user.id, referenceId);
  }
}
