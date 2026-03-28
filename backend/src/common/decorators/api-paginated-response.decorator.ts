import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Wraps a DTO in the standard paginated envelope:
 * { data: T[], nextCursor: string | null, total: number }
 */
export function ApiPaginatedResponse<T extends Type<unknown>>(dto: T) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiOkResponse({
      schema: {
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(dto) } },
          nextCursor: { type: 'string', nullable: true, example: null },
          total: { type: 'integer', example: 0 },
        },
        required: ['data', 'nextCursor', 'total'],
      },
    }),
  );
}
