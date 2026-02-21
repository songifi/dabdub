import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseHealthIndicator } from './health.indicator';
import { GlobalConfigService } from '../config/global-config.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [GlobalConfigService],
      useFactory: (config: GlobalConfigService) => {
        const db = config.getDatabaseConfig();
        const poolMax = db.poolSize;
        const poolMin = Math.min(2, db.poolSize);

        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          database: db.database,
          username: db.username,
          password: db.password,
          ssl: config.isProduction() ? { rejectUnauthorized: false } : false,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: config.isProduction(),
          synchronize: false,
          logging: config.isDevelopment() ? ['query', 'error'] : ['error'],
          extra: {
            max: poolMax,
            min: poolMin,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
          },
          retryAttempts: 5,
          retryDelay: 3000,
        };
      },
    }),
  ],
  providers: [DatabaseHealthIndicator],
  exports: [DatabaseHealthIndicator],
})
export class DatabaseModule {}
