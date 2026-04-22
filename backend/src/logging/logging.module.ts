import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import winston from 'winston';
import { appConfig } from '../config';
import type { ConfigType } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';

function buildFormat(nodeEnv: string): winston.Logform.Format {
  const isProd = nodeEnv === 'production';

  if (isProd) {
    // JSON for Datadog/Loki ingestion.
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );
  }

  // Pretty/colorized for local dev.
  return winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const rest =
        meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta, null, 2)}` : '';
      return `${timestamp} ${level} ${message}${rest}`;
    }),
  );
}

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [appConfig.KEY],
      useFactory: (app: ConfigType<typeof appConfig>) => {
        return {
          level: app.nodeEnv === 'production' ? 'info' : 'debug',
          format: buildFormat(app.nodeEnv),
          transports: [new winston.transports.Console()],
        };
      },
    }),
  ],
  exports: [WinstonModule],
})
export class LoggingModule {}

