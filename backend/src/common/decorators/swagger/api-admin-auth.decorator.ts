import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ErrorResponseDto,
  ValidationErrorItemDto,
} from '../../dto/error-response.dto';

/**
 * Applies JWT Bearer auth requirement and documents 401 response.
 * Use on controller methods or controllers that require admin JWT.
 */
export const ApiAdminAuth = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(
    ApiExtraModels(ErrorResponseDto, ValidationErrorItemDto),
    ApiBearerAuth('JWT'),
    ApiUnauthorizedResponse({
      description: 'Invalid or expired token',
      type: ErrorResponseDto,
    }),
  );
