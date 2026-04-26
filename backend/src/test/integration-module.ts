import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TEST_ENTITIES } from './db';

export async function createIntegrationTestModule(
  extraModules: any[] = [],
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME_TEST ?? 'cheesepay_test',
        entities: TEST_ENTITIES,
        synchronize: true,
        logging: false,
      }),
      JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }),
      ...extraModules,
    ],
  }).compile();
}
