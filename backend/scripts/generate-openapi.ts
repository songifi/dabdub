/**
 * Bootstraps the NestJS app, writes docs/openapi.json, then exits.
 * Usage: ts-node scripts/generate-openapi.ts
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string };

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('CheesePay API')
    .setDescription('API documentation for the CheesePay settlement platform')
    .setVersion(version)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outDir = join(__dirname, '..', 'docs');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'openapi.json'), JSON.stringify(document, null, 2));

  console.log('✅  docs/openapi.json written');
  await app.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
