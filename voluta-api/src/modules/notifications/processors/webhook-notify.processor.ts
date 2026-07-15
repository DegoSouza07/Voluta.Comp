import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface WebhookJobData {
  eventType: 'post_approved' | 'change_requested';
  postId: string;
  postOrderIndex: number;
  projectTitle?: string;
  clientName?: string;
  comment?: string;
}

// concurrency: 5 — só um POST HTTP trivial pro Slack, custo de
// recurso desprezível mesmo com vários em paralelo.
@Processor('webhook-notify', { concurrency: 5 })
export class WebhookNotifyProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookNotifyProcessor.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { eventType, postOrderIndex, projectTitle, comment } = job.data;
    const webhookUrl = this.config.get<string>('SLACK_WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL não configurado — notificação descartada.');
      return;
    }

    const text =
      eventType === 'change_requested'
        ? `🔴 *Ajuste solicitado* — Post #${postOrderIndex} do projeto "${projectTitle}"\n> ${comment ?? '(sem comentário)'}`
        : `✅ *Post aprovado* — Post #${postOrderIndex} do projeto "${projectTitle}"`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      // Lançar aqui faz o BullMQ re-tentar com o backoff configurado no
      // registerQueue — não engolimos o erro silenciosamente.
      throw new Error(`Slack respondeu ${response.status} ao notificar o post ${job.data.postId}`);
    }
  }
}
