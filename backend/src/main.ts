import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { initSentry } from './common/config/sentry.config';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json, urlencoded } from 'express';

async function bootstrap() {
  // Initialize Sentry before creating the app
  initSentry();

  const app = await NestFactory.create(AppModule);

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Global exception filters (order matters - more specific first)
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(new CustomValidationPipe());

  // Enable CORS with strict config
  const whitelist = process.env.CORS_WHITELIST ? process.env.CORS_WHITELIST.split(',') : [];
  app.enableCors({
    origin: (origin: string, callback: (err: Error | null, origin?: boolean) => void) => {
      if (!origin || whitelist.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Use helmet for security headers with CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Global IP-based rate limiting (DoS protection)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 100, // Limit each IP to 100 requests per windowMs
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  // Body parser limits
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Swagger Setup (disabled in production - /api/docs returns 404)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Cheese Admin Dashboard API')
      .setDescription(
        `
Internal API for the Cheese platform admin dashboard.
Provides endpoints for merchant management, transaction monitoring,
settlement oversight, analytics, and platform configuration.

## Authentication
Use the /auth/login endpoint to obtain a JWT access token.
Include it in the Authorization header: \`Bearer <token>\`

## Rate Limiting
All endpoints are rate limited. See response headers for limits.
`.trim(),
      )
      .setVersion('1.0.0')
      .setContact(
        'Cheese Engineering',
        'https://cheese.io',
        'engineering@cheese.io',
      )
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'JWT',
      )
      .addApiKey(
        { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        'ApiKey',
      )
      .addTag('Auth', 'Authentication and session management')
      .addTag('Admin Users', 'Admin user CRUD and permission management')
      .addTag('Merchants', 'Merchant onboarding, KYC, and lifecycle management')
      .addTag('Transactions', 'Transaction monitoring and override operations')
      .addTag('Settlements', 'Settlement management and reporting')
      .addTag('Analytics', 'Platform analytics and reporting')
      .addTag('Config', 'Platform configuration management')
      .addTag('Audit', 'Immutable audit log access')
      .addTag('Health', 'Health and readiness checks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
      },
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
