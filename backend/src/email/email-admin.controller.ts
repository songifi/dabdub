import { Body, Controller, Post, ForbiddenException, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { ZeptoMailService, ZeptoSendResult } from './zepto-mail.service';
import { TestEmailDto } from './dto/test-email.dto';

@ApiTags('admin/email')
@ApiBearerAuth()
@Controller('admin/email')
export class EmailAdminController {
  constructor(private readonly zeptoMail: ZeptoMailService) {}

  @Post('test')
  @ApiOperation({ summary: 'Send a test email immediately (admin only)' })
  async testSend(
    @Body() dto: TestEmailDto,
    @Req() req: Request,
  ): Promise<ZeptoSendResult> {
    const user = (req as any).user as { isAdmin?: boolean } | undefined;
    if (!user?.isAdmin) throw new ForbiddenException('Admin only');

    return this.zeptoMail.send(dto.to, dto.templateAlias, dto.mergeData ?? {});
  }
}
