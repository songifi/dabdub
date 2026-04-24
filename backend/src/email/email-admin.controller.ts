import { Body, Controller, Post, ForbiddenException, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { NodemailerService, MailSendResult } from './nodemailer.service';
import { TestEmailDto } from './dto/test-email.dto';

@ApiTags('admin/email')
@ApiBearerAuth()
@Controller({ path: 'admin/email', version: '1' })
export class EmailAdminController {
  constructor(private readonly mailer: NodemailerService) {}

  @Post('test')
  @ApiOperation({ summary: 'Send a test email immediately (admin only)' })
  async testSend(
    @Body() dto: TestEmailDto,
    @Req() req: Request,
  ): Promise<MailSendResult> {
    const user = (req as any).user as { isAdmin?: boolean } | undefined;
    if (!user?.isAdmin) throw new ForbiddenException('Admin only');

    return this.mailer.send(dto.to, dto.templateAlias, dto.mergeData ?? {});
  }
}
