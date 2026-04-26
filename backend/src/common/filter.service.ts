import { Injectable, BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder, MoreThanOrEqual, LessThanOrEqual, Like, In, Between } from 'typeorm';

@Injectable()
export class FilterService {
  buildWhereConditions(query: Record<string, any>, allowedFields: string[]): Record<string, any> {
    const where: Record<string, any> = {};

    for (const key in query) {
      if (!query.hasOwnProperty(key)) continue;

      const parts = key.split('_');
      if (parts.length < 2) continue; // not a filter key

      const field = parts.slice(0, -1).join('_');
      const op = parts[parts.length - 1];

      if (!allowedFields.includes(field)) {
        throw new BadRequestException(`Invalid filter field: ${field}`);
      }

      const value = query[key];

      switch (op) {
        case 'eq':
          where[field] = value;
          break;
        case 'gte':
          where[field] = MoreThanOrEqual(value);
          break;
        case 'lte':
          where[field] = LessThanOrEqual(value);
          break;
        case 'like':
          where[field] = Like(`%${value}%`);
          break;
        case 'in':
          where[field] = In(value.split(','));
          break;
        case 'between':
          const [min, max] = value.split(',');
          if (!min || !max) throw new BadRequestException(`Invalid between value for ${field}`);
          where[field] = Between(min, max);
          break;
        default:
          // ignore unknown operators
          break;
      }
    }

    return where;
  }

  applyFiltersToQueryBuilder<T>(
    qb: SelectQueryBuilder<T>,
    query: Record<string, any>,
    allowedFields: string[]
  ): SelectQueryBuilder<T> {
    const where = this.buildWhereConditions(query, allowedFields);
    qb.where(where);
    return qb;
  }
}