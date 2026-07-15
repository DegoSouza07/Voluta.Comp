import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

/**
 * Entry point de PRODUÇÃO do processo de Worker — sem HTTP, só consumidores
 * de fila (media-processing, ai-analysis, pdf-render, webhook-notify).
 *
 * `createApplicationContext` em vez de `create()`: não precisa de servidor
 * HTTP nenhum, só o container de DI rodando em background consumindo do
 * Redis.
 *
 * `enableShutdownHooks()` é essencial aqui: garante que `onModuleDestroy`
 * roda antes do processo morrer (SIGTERM/SIGINT) — é o que fecha o
 * Chromium do PdfRenderService de forma limpa e deixa o BullMQ Worker
 * drenar jobs em andamento em vez de matá-los no meio.
 */
async function bootstrap() {
  const logger = new Logger('VolutaWorker');
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();

  logger.log('Worker rodando — consumindo media-processing, ai-analysis, pdf-render, webhook-notify.');

  process.on('SIGTERM', () => logger.log('SIGTERM recebido, encerrando worker...'));
  process.on('SIGINT', () => logger.log('SIGINT recebido, encerrando worker...'));
}
bootstrap();
