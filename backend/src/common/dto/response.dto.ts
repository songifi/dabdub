/**
 * Standard API Response Envelope
 * All successful API responses follow this structure
 */
export interface ResponseEnvelope<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  meta?: PaginationMeta;
  timestamp: string;
  requestId: string;
}

/**
 * Pagination metadata for paginated responses
 */
export interface PaginationMeta {
  page?: number;
  limit: number;
  total?: number;
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Raw paginated response (before wrapping)
 */
export interface RawPaginatedResponse<T = unknown> {
  data: T[];
  limit: number;
  hasMore: boolean;
  total?: number;
  page?: number;
  nextCursor?: string;
}
