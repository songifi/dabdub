import { IsArray, ArrayMaxSize, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkMerchantActionDto {
  @ApiProperty({ type: [String], description: 'Array of merchant IDs to perform action on' })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  ids: string[];
}

export class BulkActionResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  error?: string;
}

export class BulkActionResponseDto {
  @ApiProperty({ type: [BulkActionResultDto] })
  results: BulkActionResultDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  successful: number;

  @ApiProperty()
  failed: number;
}
