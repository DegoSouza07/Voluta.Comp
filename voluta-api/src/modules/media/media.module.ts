import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Post } from '../posts/entities/post.entity';
import { Project } from '../projects/entities/project.entity';
import { PostMedia } from './entities/post-media.entity';
import { StorageService } from './storage.service';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JOB_CLEANUP_DEFAULTS } from '../../common/bullmq/job-cleanup.defaults';

/**
 * Lado API — controller de upload + geração de URL pré-assinada.
 * SÓ enfileira (`media-processing`), nunca processa a imagem aqui — quem
 * consome é o `MediaWorkerModule`, que roda no processo separado
 * `worker.ts` (Etapa 1: Sharp e Puppeteer não podem competir por CPU com
 * as requests HTTP).
 */
@Module({
  imports: [
    // Project é registrado aqui só pro construtor do TenantGuard — ver nota
    // em clients.module.ts sobre resolução de guards referenciados por classe.
    TypeOrmModule.forFeature([Post, PostMedia, Project]),
    BullModule.registerQueue({
      name: 'media-processing', // produtor — consumidor mora no worker
      defaultJobOptions: JOB_CLEANUP_DEFAULTS,
    }),
  ],
  controllers: [MediaController],
  providers: [StorageService, MediaService, TenantGuard],
  exports: [StorageService, TypeOrmModule],
})
export class MediaModule {}
