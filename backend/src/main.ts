import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { AppModule } from './app.module';
import type { AppConfig } from './config';
import { QueueBoardService } from './queue/queue.board';
import { createBullBoardBasicAuth } from './queue/queue.basic-auth';
import { BULL_BOARD_PATH } from './queue/queue.constants';
import {
  API_VERSION_POLICY,
  DOCUMENTED_API_VERSIONS,
} from './api-version/api-version.policy';
import { filterOpenApiPathsForVersion } from './api-version/filter-openapi-for-version';
import { isAllowedCorsOrigin } from './security/cors.util';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string };

// PII fields to scrub from Sentry events
const PII_FIELDS = ['email', 'phone', 'passwordHash', 'pinHash', 'encryptedSecretKey'];

function scrubPII(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(scrubPII);
  }

  if (typeof obj === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (PII_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        scrubbed[key] = '[Filtered]';
      } else {
        scrubbed[key] = scrubPII(value);
      }
    }
    return scrubbed;
  }

  return obj;
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  
  // Initialize Sentry before app bootstrap
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      release: version,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        nodeProfilingIntegration(),
      ],
      beforeSend(event) {
        // Scrub PII from all captured events
        if (event.request) {
          event.request = scrubPII(event.request) as typeof event.request;
        }
        if (event.user) {
          event.user = scrubPII(event.user) as typeof event.user;
        }
        if (event.extra) {
          event.extra = scrubPII(event.extra) as typeof event.extra;
        }
        if (event.contexts) {
          event.contexts = scrubPII(event.contexts) as typeof event.contexts;
        }
        return event;
      },
    });
    logger.log('Sentry initialized');
  } else {
    logger.warn('Sentry disabled: SENTRY_DSN not set');
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = app.get(ConfigService);
  const port = config.get<AppConfig['port']>('app.port')!;
  const apiPrefix = config.get<AppConfig['apiPrefix']>('app.apiPrefix')!;

  app.enableCors({
    origin: (origin, callback) => {
      if (
        isAllowedCorsOrigin(
          origin,
          config.get<AppConfig['frontendUrl']>('app.frontendUrl')!,
        )
      ) {
        callback(null, true);
        return;
      }

      callback(
        new Error(`Origin ${origin ?? 'unknown'} is not allowed by CORS`),
        false,
      );
    },
    credentials: true,
  });
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
  });

  const queueBoard = app.get(QueueBoardService);
  const credentials = queueBoard.getCredentials();
  app.use(
    BULL_BOARD_PATH,
    createBullBoardBasicAuth(credentials.username, credentials.password),
    queueBoard.getRouter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CheesePay API')
      .setDescription(
        'CheesePay HTTP API. Per-version specs under /docs/v{n}; default /docs matches the current major version from API_VERSION_POLICY.',
      )
      .setVersion(version)
      .addBearerAuth()
      .build();
    const fullDocument = SwaggerModule.createDocument(app, swaggerConfig);

    const currentMajor = API_VERSION_POLICY.current.replace(/^v/, '');
    for (const apiVersion of DOCUMENTED_API_VERSIONS) {
      const document = filterOpenApiPathsForVersion(fullDocument, apiVersion);
      SwaggerModule.setup(
        `${apiPrefix}/docs/v${apiVersion}`,
        app,
        document,
      );
      logger.log(
        `Swagger v${apiVersion} at http://localhost:${port}/${apiPrefix}/docs/v${apiVersion}`,
      );
    }

    const defaultDoc = filterOpenApiPathsForVersion(fullDocument, currentMajor);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, defaultDoc);
    logger.log(
      `Swagger (default = v${currentMajor}) at http://localhost:${port}/${apiPrefix}/docs`,
    );
  }

  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}/${apiPrefix}`);
}

void bootstrap();
