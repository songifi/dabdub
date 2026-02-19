import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Validation error item (e.g. for 400 validation failures).
 */
export class ValidationErrorItemDto {
  @ApiProperty({ example: 'email', description: 'Field that failed validation' })
  field: string;

  @ApiProperty({
    example: 'email must be a valid email address',
    description: 'Validation error message',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Rejected value (may be masked for sensitive data)',
  })
  rejectedValue?: unknown;

  @ApiPropertyOptional({
    description: 'Validation constraints that failed',
    example: { isEmail: 'email must be an email' },
  })
  constraints?: Record<string, string>;
}

/**
 * Standard error response shape for Swagger documentation.
 * Matches the structure returned by the global exception filter.
 */
export class ErrorResponseDto {
  @ApiProperty({
    example: false,
    description: 'Indicates if the request was successful (always false for errors)',
  })
  success: boolean;

  @ApiProperty({
    example: '2000',
    description: 'Error code from the application error code enum',
  })
  errorCode: string;

  @ApiProperty({
    example: 'Validation failed',
    description: 'User-friendly error message (safe to display to end users)',
  })
  message: string;

  @ApiPropertyOptional({
    example: 'Detailed technical message',
    description: 'Technical error message (for debugging, may contain sensitive info)',
  })
  details?: string;

  @ApiPropertyOptional({
    type: () => ValidationErrorItemDto,
    isArray: true,
    description: 'Validation errors (for validation failures)',
  })
  validationErrors?: ValidationErrorItemDto[];

  @ApiPropertyOptional({
    example: 'req-abc-123',
    description: 'Request ID for tracking (from middleware)',
  })
  requestId?: string;

  @ApiProperty({
    example: '2024-01-20T10:30:00.000Z',
    description: 'Timestamp of the error',
  })
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Stack trace (only in development)',
  })
  stack?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  metadata?: Record<string, unknown>;
}
