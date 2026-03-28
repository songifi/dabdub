import type { QueryRunner } from 'typeorm';
import { MigrationHelper } from './migration.helper';

describe('MigrationHelper', () => {
  it('addColumnIfNotExists is idempotent (same SQL each call)', async () => {
    const runner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;

    await MigrationHelper.addColumnIfNotExists(
      runner,
      'users',
      'new_col',
      'text NULL',
    );
    await MigrationHelper.addColumnIfNotExists(
      runner,
      'users',
      'new_col',
      'text NULL',
    );

    expect((runner.query as any).mock.calls[0][0]).toContain(
      'ADD COLUMN IF NOT EXISTS',
    );
    expect((runner.query as any).mock.calls[1][0]).toContain(
      'ADD COLUMN IF NOT EXISTS',
    );
    expect((runner.query as any).mock.calls[0][0]).toEqual(
      (runner.query as any).mock.calls[1][0],
    );
  });
});
