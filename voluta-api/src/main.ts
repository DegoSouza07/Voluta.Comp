import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ApiModule } from './api.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Entry point de PRODUÇÃO do processo de API — só HTTP, zero consumidor de
 * fila (ver src/worker.ts pro processo separado que consome as filas).
 * Continua respondendo em /api/v1, igual sempre respondeu.
 */
async function bootstrap() {
  const app = await NestFactory.create(ApiModule);

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // remove campos que não estão no DTO
      forbidNonWhitelisted: true, // erro explícito se o client mandar campo desconhecido
      transform: true,         // converte payload pro tipo do DTO automaticamente
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`VOLUTA API rodando em http://localhost:${port}/api/v1`);
}
bootstrap();
