import { ApiProperty } from '@nestjs/swagger';

export class BlockedIpsResponseDto {
  @ApiProperty({ type: [String], example: ['192.168.1.1'] })
  blockedIps!: string[];
}

export class UnblockIpResponseDto {
  @ApiProperty({ example: 'IP 192.168.1.1 has been unblocked' })
  message!: string;
}
