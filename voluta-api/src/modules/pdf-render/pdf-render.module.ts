import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PdfRenderController } from './pdf-render.controller';
import { JOB_CLEANUP_DEFAULTS } from '../../common/bullmq/job-cleanup.defaults';

/**
 * Lado API — só o endpoint que enfileira o render (`POST /projects/:id/render-pdf`).
 * Handlebars, Puppeteer e o mapper de dados moram no `PdfRenderWorkerModule`,
 * que roda no processo `worker.ts` — Chromium é a peça mais pesada de todo
 * o sistema, é a razão principal de existir essa separação (Etapa 1).
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'pdf-render', // produtor — consumidor mora no worker
      defaultJobOptions: JOB_CLEANUP_DEFAULTS,
    }),
  ],
  controllers: [PdfRenderController],
})
export class PdfRenderModule {}
