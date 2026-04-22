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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { VirtualAccountService } from './virtual-account.service';
import { VirtualAccountResponseDto } from './dto/virtual-account-response.dto';
import { VirtualAccountWebhookAckDto } from './dto/virtual-account-webhook-ack.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('virtual-account')
@Controller()
export class VirtualAccountController {
  constructor(private readonly vaService: VirtualAccountService) {}

  @Get('virtual-account')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get or provision the current user virtual account' })
  @ApiOkResponse({ type: VirtualAccountResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getVirtualAccount(@Req() req: Request): Promise<VirtualAccountResponseDto> {
    const userId = (req.user as { id: string }).id;
    return this.vaService.getOrProvision(userId);
  }

  @Public()
  @Post('webhooks/virtual-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Virtual account provider webhook',
    description: 'Verifies provider signature on raw body. Public endpoint.',
  })
  @ApiBody({
    description: 'Raw JSON body as sent by the provider',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiOkResponse({ type: VirtualAccountWebhookAckDto })
  @ApiUnauthorizedResponse({ description: 'Missing signature, invalid signature, or missing raw body' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('verif-hash') signature: string,
  ): Promise<VirtualAccountWebhookAckDto> {
    if (!signature) throw new UnauthorizedException('Missing signature header');
    const rawBody = req.rawBody;
    if (!rawBody) throw new UnauthorizedException('Missing raw body');
    await this.vaService.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
