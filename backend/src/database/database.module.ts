import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigType } from '@nestjs/config';
import { databaseConfig, appConfig } from '../config';
import { DatabaseMaintenanceService } from './database-maintenance.service';

/**
 * DatabaseModule owns the single TypeORM root connection.
 *
 * Rules enforced here:
 *  - synchronize is always false — schema changes happen through migrations only.
 *  - migrationsRun is true in production so the app self-migrates on startup.
 *  - autoLoadEntities: true lets TypeOrmModule.forFeature() register entities
 *    without duplicating glob patterns.
 *
 * Feature modules register their entities with:
 *   TypeOrmModule.forFeature([SomeEntity, AnotherEntity])
 *
 * Import DatabaseModule once, in AppModule only.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      // Config tokens are globally provided by AppConfigModule (isGlobal: true).
      inject: [databaseConfig.KEY, appConfig.KEY],
      useFactory: (
        db: ConfigType<typeof databaseConfig>,
        app: ConfigType<typeof appConfig>,
      ) => {
        const isProd = app.nodeEnv === 'production';
        const isDev = app.nodeEnv === 'development';

        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.user,
          password: db.pass,
          database: db.name,

          // autoLoadEntities picks up anything registered via forFeature().
          // The dist glob below is the fallback for CLI / seed contexts.
          autoLoadEntities: true,
          entities: ['dist/**/*.entity.js'],

          migrations: ['dist/database/migrations/*.js'],

          // Never auto-sync — always use migrations.
          synchronize: false,

          // Auto-run pending migrations only in production.
          migrationsRun: isProd,

          logging: isDev ? ['query', 'error', 'warn'] : ['error'],

          // Log queries that exceed 1 second in non-production environments
          maxQueryExecutionTime: isDev ? 1000 : undefined,

          // Keeps TypeORM CLI aware of where to put generated migration files.
          cli: { migrationsDir: 'src/database/migrations' },
        };
      },
    }),
  ],
  providers: [DatabaseMaintenanceService],
  exports: [DatabaseMaintenanceService],
})
export class DatabaseModule {}
