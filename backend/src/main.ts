import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { HttpAdapterHost } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import * as Sentry from "@sentry/node";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./core/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const httpAdapterHost = app.get(HttpAdapterHost);

  const sentryDsn = configService.get<string>("SENTRY_DSN");
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: configService.get<string>("NODE_ENV", "development"),
    });
  }

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost, configService));
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle("CheesePay API")
    .setDescription("Crypto-to-Fiat Settlement Platform")
    .setVersion("1.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "api-key")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`CheesePay API running on port ${process.env.PORT ?? 3000}`);
}

bootstrap();
