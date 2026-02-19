import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../dto/error-response.dto';

/**
 * Applies JWT Bearer auth requirement and documents 401 response.
 * Use on controller methods or controllers that require admin JWT.
 */
export const ApiAdminAuth = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiBearerAuth('JWT'),
    ApiUnauthorizedResponse({
      description: 'Invalid or expired token',
      type: ErrorResponseDto,
    }),
  );
