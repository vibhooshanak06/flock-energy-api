import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All routes sit under /api/v1
  app.setGlobalPrefix('api/v1');

  // Validate and transform query params / body DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,       // coerce string query params to their declared types
      whitelist: true,       // strip unknown properties
      forbidNonWhitelisted: false,
    }),
  );

  // Global error handler — normalises portal errors and unknown exceptions
  app.useGlobalFilters(new HttpExceptionFilter());

  // -------------------------------------------------------------------------
  // OpenAPI (Swagger)
  // -------------------------------------------------------------------------
  const openApiConfig = new DocumentBuilder()
    .setTitle('Urja Meter Ops API')
    .setDescription(
      'A clean REST API built over the Urja Meter Ops legacy portal.\n\n' +
      '**Data available:** meter inventory (403 meters), distribution transformers (40 DTs), ' +
      'energy/consumption readings, GPS locations, and a 7-level network hierarchy.\n\n' +
      '**Architecture note:** all data is proxied live from the upstream portal. ' +
      'Sessions are managed internally — API consumers need no portal credentials.',
    )
    .setVersion('1.0.0')
    .addTag('meters', 'Meter inventory — list and individual meter detail')
    .addTag('consumption', 'Energy readings for a meter')
    .addTag('transformers', 'Distribution transformer inventory')
    .addTag('network', 'Network hierarchy tree and bulk meter export')
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);

  // Serve Swagger UI at /docs
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Urja Meter Ops API',
    swaggerOptions: { defaultModelsExpandDepth: 1, persistAuthorization: true },
  });

  // Write openapi.json to project root on startup
  const openapiPath = path.join(process.cwd(), 'openapi.json');
  fs.writeFileSync(openapiPath, JSON.stringify(document, null, 2), 'utf-8');

  // -------------------------------------------------------------------------
  // Listen
  // -------------------------------------------------------------------------
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  console.log(`
  ┌─────────────────────────────────────────────────────┐
  │  Urja Meter Ops API                                 │
  │  Base URL   : http://localhost:${port}/api/v1           │
  │  Swagger UI : http://localhost:${port}/docs             │
  │  OpenAPI    : openapi.json (written to project root)│
  └─────────────────────────────────────────────────────┘
  `);
}

bootstrap();
