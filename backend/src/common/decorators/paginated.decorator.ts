import { SetMetadata } from '@nestjs/common';

/**
 * Marks a controller method as returning a paginated response
 * The interceptor will extract pagination metadata and move it to meta field
 */
export const PAGINATED_KEY = 'IS_PAGINATED';
export const Paginated = () => SetMetadata(PAGINATED_KEY, true);
