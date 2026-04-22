import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

/**
 * Smoke test: verifies AppModule bootstraps without throwing.
 * Uses real env vars from .env (loaded by ConfigModule).
 * Requires Postgres + Redis to be reachable (run docker-compose up -d first).
 */
describe('AppModule', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  }, 30_000);

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('should bootstrap without error', () => {
    expect(moduleRef).toBeDefined();
  });
});
