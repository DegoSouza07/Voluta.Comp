import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { AiService } from '../ai.service';
import { Post } from '../../posts/entities/post.entity';
import { PostMedia, PostMediaKind } from '../../media/entities/post-media.entity';
import { PostFormat } from '../../../common/enums/post-format.enum';
import { PostStatus } from '../../../common/enums/post-status.enum';
import { FunnelStage } from '../../../common/enums/funnel-stage.enum';

interface AiAnalysisJobData {
  postId: string;
}

const WEEKDAY_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

const PRIMARY_KIND_BY_FORMAT: Record<PostFormat, PostMediaKind> = {
  [PostFormat.REEL]: PostMediaKind.COVER,
  [PostFormat.CARROSSEL]: PostMediaKind.SLIDE,
  [PostFormat.ESTATICO]: PostMediaKind.SLIDE,
};

// concurrency: 3 — diferente de pdf-render/media-processing, isso é
// I/O-bound (o tempo todo é esperando a resposta da OpenAI pela rede),
// não CPU/RAM-bound. Rodar vários em paralelo não compete por recurso
// local do jeito que Chromium/Sharp competem.
@Processor('ai-analysis', { concurrency: 3 })
export class AiAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AiAnalysisProcessor.name);

  constructor(
    private readonly aiService: AiService,
    @InjectRepository(Post) private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostMedia) private readonly postMediaRepository: Repository<PostMedia>,
  ) {
    super();
  }

  async process(job: Job<AiAnalysisJobData>): Promise<void> {
    const { postId } = job.data;

    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: { project: { client: true } },
    });
    if (!post) {
      this.logger.warn(`Post ${postId} não encontrado — job descartado.`);
      return;
    }

    const primaryMedia = await this.postMediaRepository.findOne({
      where: { postId, kind: PRIMARY_KIND_BY_FORMAT[post.format], orderIndex: 0 },
    });
    if (!primaryMedia?.variants.preview) {
      this.logger.warn(`Post ${postId} sem mídia primária processada — job descartado.`);
      return;
    }

    post.status = PostStatus.AI_PROCESSING;
    await this.postsRepository.save(post);

    const client = post.project.client;
    const analysis = await this.aiService.analyzePost({
      imageUrl: primaryMedia.variants.preview,
      userContext: post.userContextInput ?? '',
      toneOfVoice: client.toneOfVoice ?? 'Caloroso e direto, sem formalidade excessiva.',
      brandName: client.name,
    });

    post.caption = analysis.caption;
    post.editorialLine = analysis.editorialLine;
    post.funnelStage = analysis.funnelStage as FunnelStage;
    post.emotion = analysis.emotion;
    post.tags = analysis.tags;
    post.aiRawResponse = analysis as unknown as Record<string, unknown>;
    post.status = PostStatus.AI_GENERATED;

    if (post.publishDate) {
      post.weekday = WEEKDAY_LABELS[new Date(`${post.publishDate}T12:00:00Z`).getUTCDay()];
    }

    await this.postsRepository.save(post);
  }

  onFailed(job: Job<AiAnalysisJobData>, error: Error) {
    this.logger.error(`ai-analysis falhou pro post ${job.data.postId}: ${error.message}`);
  }
}
