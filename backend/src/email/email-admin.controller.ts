import { Body, Controller, Post, ForbiddenException, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { ZeptoMailService, ZeptoSendResult } from './zepto-mail.service';
import { TestEmailDto } from './dto/test-email.dto';
import { ZeptoSendResultDto } from './dto/zepto-send-result.dto';

@ApiTags('admin/email')
@ApiBearerAuth('bearer')
@Controller('admin/email')
export class EmailAdminController {
  constructor(private readonly zeptoMail: ZeptoMailService) {}

  @Post('test')
  @ApiOperation({ summary: 'Send a test email immediately (admin only)' })
  @ApiOkResponse({ type: ZeptoSendResultDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async testSend(
    @Body() dto: TestEmailDto,
    @Req() req: Request,
  ): Promise<ZeptoSendResult> {
    const user = (req as { user?: { isAdmin?: boolean } }).user;
    if (!user?.isAdmin) throw new ForbiddenException('Admin only');

    return this.zeptoMail.send(dto.to, dto.templateAlias, dto.mergeData ?? {});
  }
}
