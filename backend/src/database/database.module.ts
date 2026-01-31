import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseHealthIndicator } from './health.indicator';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('DB_HOST', 'localhost');
        const port = configService.get<number>('DB_PORT', 5432);
        const username = configService.get<string>('DB_USERNAME', 'postgres');
        const password = configService.get<string>('DB_PASSWORD', '');
        const database = configService.get<string>('DB_NAME', 'dabdub_dev');
        const poolSize = configService.get<number>('DB_POOL_SIZE', 10);
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');

        return {
          type: 'postgres',
          host,
          port,
          username,
          password,
          database,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: nodeEnv === 'development',
          logging: nodeEnv === 'development',
          logger: 'advanced-console',
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: false,
          dropSchema: false,
          poolSize,
          maxQueryExecutionTime: 30000,
          ssl:
            nodeEnv === 'production'
              ? {
                rejectUnauthorized: false,
              }
              : false,
          extra: {
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            max: poolSize,
            statement_timeout: 30000,
          },
        };
      },
    }),
  ],
  providers: [DatabaseHealthIndicator],
  exports: [DatabaseHealthIndicator],
})
export class DatabaseModule { }
