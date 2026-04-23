import { ApiProperty } from '@nestjs/swagger';
import { BlockchainWallet } from '../entities/blockchain-wallet.entity';

export class WalletResponseDto {
  @ApiProperty()
  stellarAddress: string;

  @ApiProperty()
  balanceUsdc: string;

  @ApiProperty()
  stakedBalance: string;

  @ApiProperty({ nullable: true })
  lastSyncedAt: Date | null;

  static from(wallet: BlockchainWallet): WalletResponseDto {
    const dto = new WalletResponseDto();
    dto.stellarAddress = wallet.stellarAddress;
    dto.balanceUsdc = wallet.balanceUsdc;
    dto.stakedBalance = wallet.stakedBalance;
    dto.lastSyncedAt = wallet.lastSyncedAt ?? null;
    return dto;
  }
}
