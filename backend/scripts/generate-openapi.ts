/**
 * Bootstraps the NestJS app, writes docs/openapi-v{N}.json (+ openapi.json), then exits.
 * Usage: ts-node scripts/generate-openapi.ts
 */
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { DOCUMENTED_API_VERSIONS } from '../src/api-version/api-version.policy';
import { filterOpenApiPathsForVersion } from '../src/api-version/filter-openapi-for-version';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string };

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
  });

  const outDir = join(__dirname, '..', 'docs');
  mkdirSync(outDir, { recursive: true });

  for (const apiVersion of DOCUMENTED_API_VERSIONS) {
    const config = new DocumentBuilder()
      .setTitle('CheesePay API')
      .setDescription(
        `API documentation for the CheesePay settlement platform (HTTP v${apiVersion})`,
      )
      .setVersion(version)
      .addBearerAuth()
      .build();

    const fullDocument = SwaggerModule.createDocument(app, config);
    const document = filterOpenApiPathsForVersion(fullDocument, apiVersion);
    writeFileSync(
      join(outDir, `openapi-v${apiVersion}.json`),
      JSON.stringify(document, null, 2),
    );
    console.log(`✅  docs/openapi-v${apiVersion}.json written`);
  }

  const primary =
    DOCUMENTED_API_VERSIONS[DOCUMENTED_API_VERSIONS.length - 1]!;
  writeFileSync(
    join(outDir, 'openapi.json'),
    readFileSync(join(outDir, `openapi-v${primary}.json`), 'utf8'),
  );
  console.log('✅  docs/openapi.json (copy of latest documented version)');

  await app.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
