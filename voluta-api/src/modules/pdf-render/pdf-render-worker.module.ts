import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PdfDataMapper } from './pdf-data.mapper';
import { PdfRenderService } from './pdf-render.service';
import { PdfRenderProcessor } from './processors/pdf-render.processor';
import { ProjectsModule } from '../projects/projects.module';
import { MediaModule } from '../media/media.module';
import { JOB_CLEANUP_DEFAULTS } from '../../common/bullmq/job-cleanup.defaults';

/**
 * Lado Worker — consome `pdf-render`: PdfDataMapper -> Handlebars -> Puppeteer
 * -> upload -> ProjectsService.attachRenderedPdf(). Só importado por
 * `worker.module.ts`.
 */
@Module({
  imports: [
    ProjectsModule, // ProjectsService.attachRenderedPdf() + Repository<Project> (via TypeOrmModule exportado)
    MediaModule,    // StorageService (upload do PDF final ao bucket)
    BullModule.registerQueue({
      name: 'pdf-render',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 15000 },
        ...JOB_CLEANUP_DEFAULTS,
      },
    }),
  ],
  providers: [PdfDataMapper, PdfRenderService, PdfRenderProcessor],
})
export class PdfRenderWorkerModule {}
