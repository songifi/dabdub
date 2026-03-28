import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import type { AppConfig } from './config';
import {
  API_VERSION_POLICY,
  DOCUMENTED_API_VERSIONS,
} from './api-version/api-version.policy';
import { filterOpenApiPathsForVersion } from './api-version/filter-openapi-for-version';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string };

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = app.get(ConfigService);
  const port = config.get<AppConfig['port']>('app.port')!;
  const apiPrefix = config.get<AppConfig['apiPrefix']>('app.apiPrefix')!;

  app.enableCors();
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
  });

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

bootstrap();
