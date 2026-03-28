import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { VirtualCardService } from './virtual-card.service';
import {
  CreateVirtualCardDto,
  FundVirtualCardDto,
  VirtualCardResponseDto,
} from './dto/virtual-card.dto';
import { Public } from '../auth/decorators/public.decorator';

interface RequestWithUser {
  user?: { id: string };
  rawBody?: Buffer;
}

@ApiTags('Virtual Cards')
@ApiBearerAuth()
@Controller({ version: '1', path: 'cards' })
export class VirtualCardController {
  constructor(private readonly cardService: VirtualCardService) {}

  /**
   * Create a new virtual card.
   * Only Gold and Black tier users can create virtual cards.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new virtual card',
    description: 'Create a USD virtual card funded from USDC balance. Gold/Black tier only.',
  })
  @ApiBody({ type: CreateVirtualCardDto })
  @ApiResponse({ status: 201, type: VirtualCardResponseDto })
  @ApiResponse({ status: 403, description: 'Tier restriction - must be Gold or Black' })
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateVirtualCardDto,
  ): Promise<VirtualCardResponseDto> {
    const userId = req.user!.id;
    return this.cardService.create(userId, dto);
  }

  /**
   * List all virtual cards for the authenticated user.
   */
  @Get()
  @ApiOperation({ summary: 'List user virtual cards' })
  @ApiResponse({ status: 200, type: [VirtualCardResponseDto] })
  async list(@Req() req: RequestWithUser): Promise<VirtualCardResponseDto[]> {
    const userId = req.user!.id;
    return this.cardService.listCards(userId);
  }

  /**
   * Get a single virtual card by ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get virtual card details' })
  @ApiParam({ name: 'id', description: 'Virtual card ID' })
  @ApiResponse({ status: 200, type: VirtualCardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async getCard(
    @Req() req: RequestWithUser,
    @Param('id') cardId: string,
  ): Promise<VirtualCardResponseDto> {
    const userId = req.user!.id;
    return this.cardService.getCard(cardId, userId);
  }

  /**
   * Fund a virtual card from USDC balance.
   */
  @Post(':id/fund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fund a virtual card',
    description: 'Transfer USDC from wallet to fund the virtual card',
  })
  @ApiParam({ name: 'id', description: 'Virtual card ID' })
  @ApiBody({ type: FundVirtualCardDto })
  @ApiResponse({ status: 200, type: VirtualCardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found' })
  @ApiResponse({ status: 400, description: 'Invalid amount or card status' })
  async fund(
    @Req() req: RequestWithUser,
    @Param('id') cardId: string,
    @Body() dto: FundVirtualCardDto,
  ): Promise<VirtualCardResponseDto> {
    const userId = req.user!.id;
    return this.cardService.fund(cardId, dto, userId);
  }

  /**
   * Freeze or unfreeze a virtual card.
   */
  @Patch(':id/freeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle card freeze status',
    description: 'Freeze an active card or unfreeze a frozen card',
  })
  @ApiParam({ name: 'id', description: 'Virtual card ID' })
  @ApiResponse({ status: 200, type: VirtualCardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async freeze(
    @Req() req: RequestWithUser,
    @Param('id') cardId: string,
  ): Promise<VirtualCardResponseDto> {
    const userId = req.user!.id;
    return this.cardService.freeze(cardId, userId);
  }

  /**
   * Terminate a virtual card and refund the balance.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Terminate a virtual card',
    description: 'Terminate the card and refund remaining balance to USDC wallet',
  })
  @ApiParam({ name: 'id', description: 'Virtual card ID' })
  @ApiResponse({ status: 200, type: VirtualCardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found' })
  @ApiResponse({ status: 400, description: 'Card already terminated' })
  async terminate(
    @Req() req: RequestWithUser,
    @Param('id') cardId: string,
  ): Promise<VirtualCardResponseDto> {
    const userId = req.user!.id;
    return this.cardService.terminate(cardId, userId);
  }

  /**
   * Webhook handler for Sudo Africa card transactions.
   * Verifies signature and processes card spend events.
   */
  @Public()
  @Post('/webhooks/sudo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sudo Africa webhook handler',
    description: 'Receives card transaction notifications from Sudo Africa',
  })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleSudoWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-sudo-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) throw new UnauthorizedException('Missing signature header');
    const rawBody = req.rawBody;
    if (!rawBody) throw new UnauthorizedException('Missing raw body');

    await this.cardService.handleSudoWebhook(rawBody, signature);
    return { received: true };
  }
}
