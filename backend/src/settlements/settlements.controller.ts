import { Controller, Get, Post, Query, UseGuards, Request, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { SettlementsService, PartnerCallbackPayload } from './settlements.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PartnerSignatureGuard } from './guards/partner-signature.guard';

@ApiTags('settlements')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @ApiOperation({ summary: 'List settlements' })
  @ApiOkResponse({ description: 'Paginated settlements' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findAll(@Request() req: { user: { merchantId: string } }, @Query() pagination: PaginationDto) {
    return this.settlementsService.findAll(req.user.merchantId, pagination.page, pagination.limit);
  }
}

@ApiTags('settlements')
@Controller('settlements')
export class PartnerCallbackController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post('partner-callback')
  @UseGuards(PartnerSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive fiat settlement status callback from partner API' })
  @ApiHeader({ name: 'X-Partner-Signature', description: 'HMAC-SHA256 signature of the request body', required: true })
  handleCallback(@Body() payload: PartnerCallbackPayload) {
    return this.settlementsService.handlePartnerCallback(payload);
  }
}
