import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Post } from '../posts/entities/post.entity';
import { PostMedia } from '../media/entities/post-media.entity';
import { AiService } from './ai.service';
import { AiAnalysisProcessor } from './processors/ai-analysis.processor';
import { JOB_CLEANUP_DEFAULTS } from '../../common/bullmq/job-cleanup.defaults';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostMedia]),
    BullModule.registerQueue({
      name: 'ai-analysis',
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10000 }, ...JOB_CLEANUP_DEFAULTS },
    }),
  ],
  providers: [AiService, AiAnalysisProcessor],
})
export class AiModule {}
