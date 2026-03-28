import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlockchainWalletService } from './blockchain-wallet.service';
import { WalletResponseDto } from './dto/wallet-response.dto';

@ApiTags('Wallet')
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: BlockchainWalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user wallet info' })
  async getWallet(@Req() req: any): Promise<WalletResponseDto> {
    const wallet = await this.walletService.getWallet(req.user.id);
    return WalletResponseDto.from(wallet);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Sync and return fresh wallet balance' })
  async getBalance(@Req() req: any): Promise<WalletResponseDto> {
    const wallet = await this.walletService.syncBalance(req.user.id);
    return WalletResponseDto.from(wallet);
  }
}
