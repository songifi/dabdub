import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../dto/error-response.dto';

/**
 * Documents common error responses (400, 403, 404, 500) with the standard error shape.
 * Use alongside other response decorators on controller methods.
 */
export const ApiStandardErrors = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: 'Insufficient permissions',
      type: ErrorResponseDto,
    }),
    ApiNotFoundResponse({
      description: 'Resource not found',
      type: ErrorResponseDto,
    }),
    ApiInternalServerErrorResponse({
      description: 'Unexpected server error',
      type: ErrorResponseDto,
    }),
  );
