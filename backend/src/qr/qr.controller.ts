import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { QrService } from './qr.service';
import { UserQrQueryDto } from './dto/user-qr-query.dto';
import { QrResponseDto } from './dto/qr-response.dto';
import { QrUserResponseDto } from './dto/qr-user-response.dto';

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
class StubAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true;
  }
}

@ApiTags('qr')
@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @UseGuards(StubAuthGuard)
  @Get('user')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Generate QR for the authenticated user pay profile',
    description: 'Requires JWT (global guard). Stub guard in this module is a placeholder.',
  })
  @ApiOkResponse({ type: QrUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getUserQr(
    @Query() query: UserQrQueryDto,
    @Req() req: Request,
  ): Promise<QrUserResponseDto> {
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
  @ApiOperation({
    summary: 'Generate QR for a pay link',
    description: 'Public. Validates pay link is active before generating.',
  })
  @ApiParam({
    name: 'tokenId',
    description: 'Stellar contract PayLink token ID',
    example: 'PLK-abc123',
  })
  @ApiOkResponse({ type: QrResponseDto })
  @ApiNotFoundResponse({ description: 'Pay link inactive or unknown token' })
  @ApiBadRequestResponse({ description: 'Invalid token' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPayLinkQr(@Param('tokenId') tokenId: string): Promise<QrResponseDto> {
    return this.qrService.generatePayLinkQr(tokenId);
  }
}
