import {
  Controller,
  Get,
  Post,
  Req,
  Headers,
  RawBodyRequest,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { VirtualAccountService } from './virtual-account.service';
import { VirtualAccountResponseDto } from './dto/virtual-account-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class VirtualAccountController {
  constructor(private readonly vaService: VirtualAccountService) {}

  @Get('virtual-account')
  async getVirtualAccount(@Req() req: Request): Promise<VirtualAccountResponseDto> {
    const userId = (req.user as { id: string }).id;
    return this.vaService.getOrProvision(userId);
  }

  @Public()
  @Post('webhooks/virtual-account')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('verif-hash') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) throw new UnauthorizedException('Missing signature header');
    const rawBody = req.rawBody;
    if (!rawBody) throw new UnauthorizedException('Missing raw body');
    await this.vaService.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
