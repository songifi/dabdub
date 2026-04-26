import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BlockchainWalletService } from './blockchain-wallet.service';
import { WalletResponseDto } from './dto/wallet-response.dto';

export class ProvisionWalletDto {
  userId: string;
  username: string;
}

/**
 * Internal controller for wallet provisioning.
 * Called by auth/registration service after user signup.
 * Not exposed to public API routes.
 */
@ApiTags('Internal - Wallet')
@Controller('internal/wallet')
export class InternalWalletController {
  constructor(private readonly walletService: BlockchainWalletService) {}

  @Post('provision')
  @ApiOperation({ summary: 'Provision wallet for new user (internal only)' })
  async provision(@Body() dto: ProvisionWalletDto): Promise<WalletResponseDto> {
    const wallet = await this.walletService.provision(dto.userId, dto.username);
    return WalletResponseDto.from(wallet);
  }
}