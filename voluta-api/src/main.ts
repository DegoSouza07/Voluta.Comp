import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ApiModule } from './api.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { resolveCorsOrigin } from './common/utils/cors-origin.util';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({ origin: resolveCorsOrigin(process.env.CORS_ORIGIN) });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`VOLUTA API rodando em http://localhost:${port}/api/v1`);
}
bootstrap();