import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      db: { status: 'up' },
      redis: { status: 'up' },
      stellar: { status: 'up' },
    },
  })
  info!: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Populated when checks fail',
  })
  error!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  details!: Record<string, unknown>;
}
