/**
 * Response Interceptor - Usage Guide
 *
 * This document provides examples of how to use the response interceptor
 * and its associated decorators.
 */

// ============================================================================
// Basic Usage - Automatic Wrapping
// ============================================================================
/*
 * All endpoints are automatically wrapped in the standard envelope:
 * { success: true, data: T, timestamp: string, requestId: string }
 */

import { Controller, Get } from '@nestjs/common';

@Controller('users')
export class UserController {
  @Get(':id')
  getUser() {
    // Returns: { success: true, data: { id: 1, name: "John" }, ... }
    return { id: 1, name: 'John' };
  }
}

// ============================================================================
// Custom Success Message - @ApiResponse()
// ============================================================================
/*
 * Add a custom success message to the response envelope
 */

import { ApiResponse } from '../common/decorators';

@Controller('users')
export class UserController {
  @Post()
  @ApiResponse('User created successfully')
  createUser() {
    // Returns: {
    //   success: true,
    //   data: { id: 1, name: "Jane" },
    //   message: "User created successfully",
    //   timestamp: "2024-03-26T...",
    //   requestId: "..."
    // }
    return { id: 1, name: 'Jane' };
  }
}

// ============================================================================
// Paginated Responses - @Paginated()
// ============================================================================
/*
 * Mark responses as paginated. The interceptor will extract pagination
 * metadata and move it to the meta field.
 */

import { Paginated } from '../common/decorators';

interface PaginatedUsersResponse {
  data: Array<{ id: number; name: string }>;
  limit: number;
  total: number;
  page: number;
  hasMore: boolean;
  nextCursor?: string;
}

@Controller('users')
export class UserController {
  @Get()
  @Paginated()
  listUsers(): PaginatedUsersResponse {
    return {
      data: [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ],
      limit: 20,
      total: 100,
      page: 1,
      hasMore: true,
      nextCursor: 'next-page-token',
    };
    // Returns: {
    //   success: true,
    //   data: [{ id: 1, name: "User 1" }, { id: 2, name: "User 2" }],
    //   meta: {
    //     limit: 20,
    //     total: 100,
    //     page: 1,
    //     hasMore: true,
    //     nextCursor: "next-page-token"
    //   },
    //   timestamp: "2024-03-26T...",
    //   requestId: "..."
    // }
  }
}

// ============================================================================
// Skip Wrapping - @SkipResponseWrap()
// ============================================================================
/*
 * Skip the response envelope wrapper for specific endpoints
 * Use this for:
 * - Health checks
 * - File downloads
 * - Streaming responses
 * - Swagger/Docs endpoints
 * - Admin queue dashboards
 */

import { SkipResponseWrap } from '../common/decorators';

@Controller('health')
export class HealthController {
  @Get()
  @SkipResponseWrap()
  checkHealth() {
    // Returns: { status: "ok", uptime: 12345 }
    // WITHOUT wrapping in envelope
    return { status: 'ok', uptime: process.uptime() };
  }
}

@Controller('files')
export class FileController {
  @Get('download/:id')
  @SkipResponseWrap()
  downloadFile() {
    // Returns raw file stream without wrapping
    return new StreamableFile(fileBuffer);
  }
}

// ============================================================================
// Combined Decorators
// ============================================================================
/*
 * You can combine multiple decorators
 */

@Post('users')
@ApiResponse('User created successfully')
createUser() {
  return { id: 1, name: 'Jane' };
}

// ============================================================================
// Response Timing
// ============================================================================
/*
 * The interceptor automatically measures and reports response time
 * Check the X-Response-Time response header:
 * X-Response-Time: 45ms
 */

// ============================================================================
// RequestId from CorrelationId
// ============================================================================
/*
 * The requestId in the response envelope is automatically populated from
 * the x-correlation-id request header (or a generated UUID if not provided)
 * This allows tracing requests across services
 */

// Client sends:
// GET /api/users
// x-correlation-id: my-unique-trace-id
//
// Response includes:
// {
//   success: true,
//   data: [...],
//   requestId: "my-unique-trace-id",
//   ...
// }
