import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { CreatePayLinkDto } from './dto/create-pay-link.dto';
import { ListPayLinksQueryDto } from './dto/list-pay-links-query.dto';
import { ListPayLinksResponseDto } from './dto/list-pay-links-response.dto';
import { PayLinkPublicDto } from './dto/pay-link-public.dto';
import { PayLink } from './entities/pay-link.entity';
import { PayLinkService } from './paylink.service';

type AuthenticatedRequest = Request & { user: User };

@ApiTags('paylinks')
@ApiBearerAuth()
@Controller('paylinks')
export class PayLinkController {
  constructor(private readonly payLinkService: PayLinkService) {}

  @Post()
  @ApiOperation({ summary: 'Create a one-time PayLink' })
  @ApiResponse({ status: 201, type: PayLink })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePayLinkDto,
  ): Promise<PayLink> {
    return this.payLinkService.create(req.user, dto);
  }

  @Public()
  @Get(':tokenId')
  @ApiOperation({ summary: 'Get public PayLink checkout details' })
  @ApiResponse({ status: 200, type: PayLinkPublicDto })
  getPublic(@Param('tokenId') tokenId: string): Promise<PayLinkPublicDto> {
    return this.payLinkService.getPublic(tokenId);
  }

  @Post(':tokenId/pay')
  @ApiOperation({ summary: 'Pay a PayLink' })
  @ApiResponse({ status: 200, type: PayLink })
  pay(
    @Param('tokenId') tokenId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PayLink> {
    return this.payLinkService.pay(tokenId, req.user);
  }

  @Delete(':tokenId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a PayLink (creator only)' })
  @ApiResponse({ status: 200, type: PayLink })
  cancel(
    @Param('tokenId') tokenId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PayLink> {
    return this.payLinkService.cancel(tokenId, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List creator PayLinks with pagination/filter' })
  @ApiResponse({ status: 200, type: ListPayLinksResponseDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListPayLinksQueryDto,
  ): Promise<ListPayLinksResponseDto> {
    return this.payLinkService.listForCreator(req.user, query);
  }
}
