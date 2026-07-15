import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Post } from '../posts/entities/post.entity';
import { PostMedia } from './entities/post-media.entity';
import { StorageService } from './storage.service';
import { MediaProcessingProcessor } from './processors/media-processing.processor';
import { JOB_CLEANUP_DEFAULTS } from '../../common/bullmq/job-cleanup.defaults';

/**
 * Lado Worker — consome `media-processing` (gera thumbnail/preview/render_ready
 * via Sharp) e produz pra `ai-analysis` quando a mídia primária termina.
 * Só importado por `worker.module.ts`, nunca por `api.module.ts`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostMedia]),
    BullModule.registerQueue(
      {
        name: 'media-processing',
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, ...JOB_CLEANUP_DEFAULTS },
      },
      { name: 'ai-analysis', defaultJobOptions: JOB_CLEANUP_DEFAULTS }, // produtor aqui, consumidor no AiModule
    ),
  ],
  providers: [StorageService, MediaProcessingProcessor],
})
export class MediaWorkerModule {}
