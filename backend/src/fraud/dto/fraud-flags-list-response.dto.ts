import { ApiProperty } from '@nestjs/swagger';
import { FraudFlagResponseDto } from './fraud-flag-response.dto';

export class FraudFlagsListResponseDto {
  @ApiProperty({ type: [FraudFlagResponseDto] })
  data!: FraudFlagResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
