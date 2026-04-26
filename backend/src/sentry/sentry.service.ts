import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import type { SentryConfig } from '../config/sentry.config';

@Injectable()
export class SentryService {
  private readonly logger = new Logger(SentryService.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  init(): void {
    const cfg = this.configService.get<SentryConfig>('sentry');
    if (!cfg?.enabled || !cfg.dsn) {
      this.logger.log('Sentry is disabled (no DSN or test environment)');
      return;
    }

    Sentry.init({
      dsn: cfg.dsn,
      environment: cfg.environment,
      tracesSampleRate: cfg.tracesSampleRate,
      profilesSampleRate: cfg.profilesSampleRate,
      integrations: [
        Sentry.httpIntegration(),
      ],
      beforeSend: (event: Sentry.ErrorEvent) => {
        // Sanitize sensitive fields from event
        if (event.request?.headers) {
          delete (event.request.headers as Record<string, unknown>)['authorization'];
          delete (event.request.headers as Record<string, unknown>)['cookie'];
        }
        return event;
      },
    });

    this.initialized = true;
    this.logger.log(`Sentry initialized (env=${cfg.environment}, traces=${cfg.tracesSampleRate})`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

