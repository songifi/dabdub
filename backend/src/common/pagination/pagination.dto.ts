// backend/src/common/pagination/pagination.dto.ts

import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PaginationDto {
  /**
   * Maximum number of records to return.
   * Defaults to 20, capped at 100.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  limit: number = 20;

  /**
   * Opaque cursor string returned by the previous page response.
   * Omit to start from the beginning.
   */
  @IsOptional()
  cursor?: string;
}

/** Shape of every paginated list response. */
export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}