import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { WalletResponseDto } from './dto/wallet-response.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Get wallet info (cached)' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  async getWallet(@Req() req: any): Promise<WalletResponseDto> {
    const wallet = await this.walletsService.findByUserId(req.user.id);
    return WalletResponseDto.fromEntity(wallet);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Sync and return fresh wallet balance' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  async getBalance(@Req() req: any): Promise<WalletResponseDto> {
    const wallet = await this.walletsService.syncBalance(req.user.id);
    return WalletResponseDto.fromEntity(wallet);
  }
}
