import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import type { AppConfig } from './config';
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
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      { path: 'docs', method: RequestMethod.ALL },
      { path: 'docs/(.*)', method: RequestMethod.ALL },
      { path: 'docs-json', method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cheese Backend API')
    .setDescription(
      'REST API for Cheese. Use **Authorize** to set JWT Bearer and/or **X-API-Key** for integrator calls. ' +
        `Prefixed routes live under \`/${apiPrefix}\`; Swagger UI is mounted at \`/docs\`.`,
    )
    .setVersion(version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token (Authorization: Bearer <token>)',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Optional API key for server-to-server / integrator access',
      },
      'api-key',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Cheese API',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
      displayRequestDuration: true,
    },
  });

  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger UI at http://localhost:${port}/docs`);
  logger.log(`OpenAPI JSON at http://localhost:${port}/docs-json`);
}

bootstrap();
