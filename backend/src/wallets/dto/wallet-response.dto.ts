import { ApiProperty } from '@nestjs/swagger';
import { Wallet } from '../entities/wallet.entity';

export class WalletResponseDto {
  @ApiProperty({ example: 'GABC...XYZ' })
  stellarAddress!: string;

  @ApiProperty({ example: '10.50', description: 'Balance in USDC (formatted)' })
  balance!: string;

  @ApiProperty({ example: '5.00', description: 'Staked balance in USDC (formatted)' })
  stakedBalance!: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', nullable: true })
  lastSyncedAt!: Date | null;

  static fromEntity(wallet: Wallet): WalletResponseDto {
    const dto = new WalletResponseDto();
    dto.stellarAddress = wallet.stellarAddress;
    dto.balance = formatStroops(wallet.balance);
    dto.stakedBalance = formatStroops(wallet.stakedBalance);
    dto.lastSyncedAt = wallet.lastSyncedAt;
    return dto;
  }
}

/** Convert stroops (integer string) to USDC decimal string (7 decimal places). */
function formatStroops(stroops: string): string {
  const n = BigInt(stroops || '0');
  const whole = n / 10_000_000n;
  const frac = n % 10_000_000n;
  return `${whole}.${frac.toString().padStart(7, '0')}`;
}
