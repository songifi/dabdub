import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Query parameters for paginated list endpoints.
 * Supports both page/limit and cursor-based pagination.
 */
export class PaginationQueryDto {
  @ApiProperty({ default: 1, minimum: 1, description: 'Page number (1-based)' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 1 : Number(value)))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Number of items per page',
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 20 : Number(value)))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination (opaque token)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

/**
 * Metadata for paginated responses.
 */
export class PaginationMetaDto {
  @ApiProperty({ example: 150, description: 'Total number of items' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 8, description: 'Total number of pages' })
  totalPages: number;

  @ApiPropertyOptional({
    description: 'Cursor for the next page (cursor-based pagination)',
  })
  nextCursor?: string;
}

/**
 * Paginated response wrapper (base schema for Swagger).
 * Use @ApiPaginatedResponse(ItemDto) on endpoints to document the concrete item type.
 */
export class PaginatedResponseDto {
  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'List of items' })
  data: unknown[];

  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Pagination metadata',
  })
  meta: PaginationMetaDto;
}
