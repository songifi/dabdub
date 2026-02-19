import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../dto/pagination.dto';

/**
 * Documents a 200 response as a paginated list with the given item DTO.
 * Use on controller methods that return paginated data.
 *
 * @param dto - The DTO class for items in the `data` array
 * @example
 * @ApiPaginatedResponse(MerchantResponseDto)
 * @Get()
 * async list() { ... }
 */
export const ApiPaginatedResponse = <T extends Type<unknown>>(
  dto: T,
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(PaginatedResponseDto, PaginationMetaDto, dto),
    ApiOkResponse({
      description: 'Paginated list of items',
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dto) },
              },
            },
          },
        ],
      },
    }),
  );
