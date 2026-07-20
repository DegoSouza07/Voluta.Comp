import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PostApproval } from './entities/post-approval.entity';
import { Post } from '../posts/entities/post.entity';
import { ApprovalService } from './approval.service';
import { PublicController } from './public.controller';
import { ApprovalController } from './approval.controller';
import { ProjectsModule } from '../projects/projects.module';
import { JOB_CLEANUP_DEFAULTS } from '../../common/bullmq/job-cleanup.defaults';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostApproval, Post]),
    BullModule.registerQueue({
      name: 'webhook-notify',
      defaultJobOptions: JOB_CLEANUP_DEFAULTS,
    }),
    ProjectsModule,
  ],
  controllers: [PublicController, ApprovalController],
  providers: [ApprovalService],
})
export class ApprovalModule {}