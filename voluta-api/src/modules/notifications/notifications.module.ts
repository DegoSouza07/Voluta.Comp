import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookNotifyProcessor } from './processors/webhook-notify.processor';
import { JOB_CLEANUP_DEFAULTS } from '../../common/bullmq/job-cleanup.defaults';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'webhook-notify',
      defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 3000 }, ...JOB_CLEANUP_DEFAULTS },
    }),
  ],
  providers: [WebhookNotifyProcessor],
})
export class NotificationsModule {}
