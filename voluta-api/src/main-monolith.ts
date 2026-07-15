import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Entry point de DESENVOLVIMENTO LOCAL — API + Worker no mesmo processo
 * (AppModule = ApiModule + WorkerModule). Existe só pra não precisar
 * abrir dois terminais (`npm run start:dev` + `npm run start:worker:dev`)
 * enquanto você tá codando. Nunca usar isso em produção — ver
 * README "API e Worker separados" pro porquê.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' });
  app.enableShutdownHooks(); // fecha o Chromium do PdfRenderService de forma limpa aqui também

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`VOLUTA (monólito API+Worker) rodando em http://localhost:${port}/api/v1`);
}
bootstrap();
