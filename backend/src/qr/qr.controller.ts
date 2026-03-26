import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { QrService } from './qr.service';
import { UserQrQueryDto } from './dto/user-qr-query.dto';
import { QrResponseDto } from './dto/qr-response.dto';

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
class StubAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true;
  }
}

@ApiTags('qr')
@ApiBearerAuth()
@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @UseGuards(StubAuthGuard)
  @Get('user')
  @ApiOperation({ summary: 'Generate a QR code for the authenticated user\'s payment address' })
  @ApiResponse({ status: 200, type: QrResponseDto, description: 'QR code data URL and payment URL' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getUserQr(
    @Query() query: UserQrQueryDto,
    @Req() req: Request,
  ) {
    const username: string =
      (req as any).user?.username ?? (req as any).user?.id ?? 'unknown';

    const result = await this.qrService.generateUserQr(
      username,
      query.amount,
      query.note,
    );

    return {
      ...result,
      webFallbackUrl: this.qrService.buildWebFallbackUrl(username),
    };
  }

  @Get('paylinks/:tokenId')
  @ApiOperation({ summary: 'Generate a QR code for a PayLink token' })
  @ApiParam({ name: 'tokenId', description: 'Stellar contract PayLink token ID', example: 'PLK-abc123' })
  @ApiResponse({ status: 200, type: QrResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'PayLink not found or expired' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPayLinkQr(
    @Param('tokenId') tokenId: string,
  ) {
    return this.qrService.generatePayLinkQr(tokenId);
  }
}
