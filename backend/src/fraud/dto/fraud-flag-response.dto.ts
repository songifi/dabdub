import { ApiProperty } from '@nestjs/swagger';
import { FraudSeverity, FraudStatus } from '../entities/fraud-flag.entity';

export class FraudFlagResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  rule!: string;

  @ApiProperty({ enum: FraudSeverity })
  severity!: FraudSeverity;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  triggeredBy!: string;

  @ApiProperty({ enum: FraudStatus })
  status!: FraudStatus;

  @ApiProperty({ type: String, nullable: true })
  resolvedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  resolutionNote!: string | null;
}
