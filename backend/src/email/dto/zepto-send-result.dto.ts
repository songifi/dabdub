import { ApiProperty } from '@nestjs/swagger';

export class ZeptoSendResultDto {
  @ApiProperty({ description: 'Provider message id', example: 'msg_abc123' })
  messageId!: string;
}
