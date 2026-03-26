import { SetMetadata } from '@nestjs/common';

/**
 * Marks a controller/route to skip response envelope wrapping
 * Used for health checks, Swagger docs, file downloads, streaming responses, etc.
 *
 * @example
 * @SkipResponseWrap()
 * @Get('health')
 * health() { ... }
 */
export const SKIP_RESPONSE_WRAP_KEY = 'SKIP_RESPONSE_WRAP';
export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP_KEY, true);
