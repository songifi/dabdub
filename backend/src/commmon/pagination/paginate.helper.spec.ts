// backend/src/common/pagination/paginate.helper.spec.ts

import { encodeCursor, decodeCursor, paginate } from './paginate.helper';
import { SelectQueryBuilder } from 'typeorm';

// ─── Cursor helpers ───────────────────────────────────────────────────────────

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a valid cursor', () => {
    const date = new Date('2024-01-15T10:00:00Z');
    const id = 'abc-123';
    const cursor = encodeCursor(date, id);
    const decoded = decodeCursor(cursor);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(id);
    expect(new Date(decoded!.createdAt).toISOString()).toBe(date.toISOString());
  });

  it('accepts a string date', () => {
    const cursor = encodeCursor('2024-06-01T00:00:00.000Z', 'xyz');
    const decoded = decodeCursor(cursor);
    expect(decoded!.createdAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('returns null for undefined cursor', () => {
    expect(decodeCursor(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeCursor('')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(decodeCursor('not-valid-base64!!')).toBeNull();
  });

  it('returns null when payload is missing fields', () => {
    const bad = Buffer.from(JSON.stringify({ createdAt: '2024-01-01' })).toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });
});

// ─── paginate helper ──────────────────────────────────────────────────────────

type FakeRow = { id: string; createdAt: Date };

/**
 * Builds a minimal mock SelectQueryBuilder that returns `rows` from getMany().
 */
function makeQb(rows: FakeRow[]) {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  } as unknown as SelectQueryBuilder<FakeRow>;
}

function makeRows(count: number): FakeRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i + 1}`,
    createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`),
  }));
}

describe('paginate()', () => {
  it('returns all items when fewer than limit', async () => {
    const rows = makeRows(3);
    const result = await paginate(makeQb(rows), { limit: 20 });
    expect(result.data).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('sets hasMore=true and trims data when there is a next page', async () => {
    // getMany returns limit+1 rows → helper knows there is more
    const rows = makeRows(21); // limit 20 → 21st is the "extra"
    const result = await paginate(makeQb(rows), { limit: 20 });
    expect(result.data).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it('encodes the last item in the page as nextCursor', async () => {
    const rows = makeRows(6); // limit 5 → 6th is extra
    const result = await paginate(makeQb(rows), { limit: 5 });
    const decoded = decodeCursor(result.nextCursor!);
    expect(decoded!.id).toBe('id-5');
  });

  it('applies cursor WHERE clause when a cursor is provided', async () => {
    const rows = makeRows(3);
    const qb = makeQb(rows);
    const cursor = encodeCursor(new Date('2024-01-01T00:00:00Z'), 'id-1');
    await paginate(qb, { limit: 10, cursor });
    expect(qb.andWhere).toHaveBeenCalledTimes(1);
    const [clause] = (qb.andWhere as jest.Mock).mock.calls[0];
    expect(clause).toContain('cursorDate');
    expect(clause).toContain('cursorId');
  });

  it('does NOT apply cursor WHERE clause on first page (no cursor)', async () => {
    const qb = makeQb(makeRows(3));
    await paginate(qb, { limit: 10 });
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('returns empty data and null cursor for zero results', async () => {
    const result = await paginate(makeQb([]), { limit: 20 });
    expect(result.data).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('uses default alias "entity" when none supplied', async () => {
    const qb = makeQb(makeRows(2));
    await paginate(qb, { limit: 10, cursor: encodeCursor(new Date(), 'x') });
    const [clause] = (qb.andWhere as jest.Mock).mock.calls[0];
    expect(clause).toContain('entity.createdAt');
  });

  it('uses the supplied alias', async () => {
    const qb = makeQb(makeRows(2));
    const cursor = encodeCursor(new Date(), 'x');
    await paginate(qb, { limit: 10, cursor, alias: 'split' });
    const [clause] = (qb.andWhere as jest.Mock).mock.calls[0];
    expect(clause).toContain('split.createdAt');
  });

  it('fetches limit + 1 rows', async () => {
    const qb = makeQb([]);
    await paginate(qb, { limit: 25 });
    expect(qb.take).toHaveBeenCalledWith(26);
  });
});