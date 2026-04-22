import { ApiProperty } from '@nestjs/swagger';

export class VirtualAccountWebhookAckDto {
  @ApiProperty({ example: true })
  received!: boolean;
}
