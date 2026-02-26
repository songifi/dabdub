// backend/src/common/pagination/paginate.helper.ts

import { SelectQueryBuilder } from 'typeorm';
import { PaginatedResponse } from './pagination.dto';

// ─── Cursor encoding ──────────────────────────────────────────────────────────

interface CursorPayload {
  createdAt: string; // ISO-8601
  id: string;
}

/**
 * Encode a { createdAt, id } pair into a base-64 cursor string.
 */
export function encodeCursor(createdAt: Date | string, id: string): string {
  const payload: CursorPayload = {
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    id,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Decode a cursor string back to its payload.
 * Returns `null` if the cursor is missing or malformed.
 */
export function decodeCursor(cursor?: string): CursorPayload | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as CursorPayload;
    if (!payload.createdAt || !payload.id) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Core paginator ───────────────────────────────────────────────────────────

export interface PaginateOptions {
  /** Decoded cursor (null = first page). */
  cursor?: string;
  /** Number of records per page (already validated, 1–100). */
  limit: number;
  /**
   * Alias used in the QueryBuilder for the entity table.
   * Defaults to 'entity'.
   */
  alias?: string;
}

/**
 * Apply cursor-based pagination to any TypeORM SelectQueryBuilder.
 *
 * The query must already have the table alias set and any WHERE / JOIN
 * clauses you need added before calling this helper.
 *
 * The helper:
 *  1. Applies the (createdAt, id) cursor condition when a cursor is provided.
 *  2. Orders by createdAt ASC, id ASC.
 *  3. Fetches limit + 1 rows to determine `hasMore`.
 *  4. Returns a `PaginatedResponse<T>` with the encoded `nextCursor`.
 *
 * @example
 * ```ts
 * const qb = this.splitsRepo
 *   .createQueryBuilder('split')
 *   .where('split.userId = :userId', { userId });
 *
 * return paginate(qb, { cursor: dto.cursor, limit: dto.limit, alias: 'split' });
 * ```
 */
export async function paginate<T extends { createdAt: Date; id: string }>(
  qb: SelectQueryBuilder<T>,
  options: PaginateOptions,
): Promise<PaginatedResponse<T>> {
  const alias = options.alias ?? 'entity';
  const limit = options.limit;

  const decoded = decodeCursor(options.cursor);

  if (decoded) {
    // Return rows that come AFTER the cursor:
    // (createdAt > cursor.createdAt)
    // OR (createdAt = cursor.createdAt AND id > cursor.id)
    qb.andWhere(
      `(${alias}.createdAt > :cursorDate OR (${alias}.createdAt = :cursorDate AND ${alias}.id > :cursorId))`,
      {
        cursorDate: new Date(decoded.createdAt),
        cursorId: decoded.id,
      },
    );
  }

  qb.orderBy(`${alias}.createdAt`, 'ASC')
    .addOrderBy(`${alias}.id`, 'ASC')
    .take(limit + 1); // fetch one extra to check hasMore

  const rows = await qb.getMany();

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  const lastItem = data[data.length - 1];
  const nextCursor =
    hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null;

  return { data, nextCursor, hasMore };
}