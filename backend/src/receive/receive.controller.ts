import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { User } from '../users/entities/user.entity';
import { ReceiveService } from './receive.service';
import { CreateReceivePayLinkDto } from './dto/create-receive-paylink.dto';

type AuthenticatedRequest = Request & { user: User };

@ApiTags('receive')
@ApiBearerAuth()
@Controller('receive')
export class ReceiveController {
  constructor(private readonly receiveService: ReceiveService) {}

  @Get('info')
  @ApiOperation({ summary: 'Receive options overview (Stellar, VA if any, active PayLink count)' })
  @ApiResponse({ status: 200 })
  getInfo(@Req() req: AuthenticatedRequest) {
    return this.receiveService.getInfo(req.user);
  }

  @Get('stellar')
  @ApiOperation({ summary: 'Stellar USDC deposit details and QR (web+stellar URI)' })
  @ApiResponse({ status: 200 })
  getStellar(@Req() req: AuthenticatedRequest) {
    return this.receiveService.getStellarReceive(req.user);
  }

  @Get('virtual-account')
  @ApiOperation({ summary: 'Virtual NGN account (lazy-provision)' })
  @ApiResponse({ status: 200 })
  getVirtualAccount(@Req() req: AuthenticatedRequest) {
    return this.receiveService.getVirtualAccountReceive(req.user);
  }

  @Post('paylink')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create PayLink and return public URL + QR' })
  @ApiResponse({ status: 201 })
  createPaylink(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateReceivePayLinkDto,
  ) {
    return this.receiveService.createPaylinkFromReceive(req.user, dto);
  }

  @Get('qr')
  @ApiOperation({ summary: 'QR codes for Stellar, virtual account, and username pay (cached 1h)' })
  @ApiResponse({ status: 200 })
  getQrBundle(@Req() req: AuthenticatedRequest) {
    return this.receiveService.getQrBundle(req.user);
  }
}
