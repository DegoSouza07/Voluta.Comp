import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import sharp from 'sharp';
import { Logger } from '@nestjs/common';
import { StorageService } from '../storage.service';
import { PostMedia, PostMediaKind } from '../entities/post-media.entity';
import { Post } from '../../posts/entities/post.entity';
import { PostFormat } from '../../../common/enums/post-format.enum';

interface MediaProcessingJobData {
  postMediaId: string;
}

// A mídia "primária" é a que dispara a análise de IA (Etapa 3) — sempre
// a que melhor representa o post visualmente, mesmo que outras mídias
// ainda estejam processando (ex: slide 2 e 3 de um carrossel podem
// terminar depois, sem bloquear a legenda sugerida).
const PRIMARY_KIND_BY_FORMAT: Record<PostFormat, PostMediaKind> = {
  [PostFormat.REEL]: PostMediaKind.COVER,
  [PostFormat.CARROSSEL]: PostMediaKind.SLIDE,
  [PostFormat.ESTATICO]: PostMediaKind.SLIDE,
};

/**
 * Consome a fila `media-processing`. Gera as 3 variantes de imagem
 * (thumbnail/preview/render_ready) a partir do arquivo original de UM
 * slot de mídia (PostMedia) — não do post inteiro, já que agora um post
 * pode ter várias mídias (Reel: cover+reel; Carrossel: N slides).
 */
// concurrency: 2 — Sharp é significativamente mais leve que o Chromium do
// pdf-render, mas decodificar+redimensionar um JPEG de ensaio fotográfico
// em alta resolução ainda usa CPU/RAM de verdade. 2 em paralelo é um
// meio-termo razoável; ajuste pra baixo se o worker estiver no limite de
// RAM junto com o pdf-render rodando ao mesmo tempo.
@Processor('media-processing', { concurrency: 2 })
export class MediaProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessingProcessor.name);

  constructor(
    private readonly storageService: StorageService,
    @InjectRepository(PostMedia) private readonly postMediaRepository: Repository<PostMedia>,
    @InjectRepository(Post) private readonly postsRepository: Repository<Post>,
    @InjectQueue('ai-analysis') private readonly aiQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<MediaProcessingJobData>): Promise<void> {
    const { postMediaId } = job.data;
    const media = await this.postMediaRepository.findOne({ where: { id: postMediaId } });
    if (!media) {
      this.logger.warn(`PostMedia ${postMediaId} não encontrada — job descartado.`);
      return;
    }

    // Vídeo (kind=reel) não passa pelo Sharp — Sharp só decodifica imagem,
    // e tentar rodar resize/webp em cima de um buffer de vídeo derruba o
    // job com erro. Ainda não temos ffmpeg instalado pra extrair um frame
    // e gerar thumbnail de vídeo de verdade (próximo passo natural, não
    // implementado agora). O PdfDataMapper já sabe cair pro frame de capa
    // quando o reel não tem variants (`reelFrameUrl` tem fallback pra
    // `coverImage` documentado) — então aqui só confirmamos o recebimento,
    // sem gerar (nem fingir gerar) uma variante que não existe de verdade.
    if (media.kind === PostMediaKind.REEL) {
      this.logger.log(`Mídia ${postMediaId} é vídeo — sem geração de thumbnail por enquanto (sem ffmpeg no worker).`);
      return;
    }

    const originalKey = this.storageService.keyFromPublicUrl(media.originalUrl);
    const originalBuffer = await this.storageService.downloadBuffer(originalKey);
    const basePath = originalKey.replace(/\.[^./]+$/, '');

    const [thumbnail, preview, renderReady] = await Promise.all([
      sharp(originalBuffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 75 }).toBuffer(),
      sharp(originalBuffer).resize(1200).webp({ quality: 85 }).toBuffer(),
      sharp(originalBuffer).resize(2400, undefined, { withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer(),
    ]);

    const [thumbnailUrl, previewUrl, renderReadyUrl] = await Promise.all([
      this.storageService.uploadBuffer(`${basePath}-thumbnail.webp`, thumbnail, 'image/webp'),
      this.storageService.uploadBuffer(`${basePath}-preview.webp`, preview, 'image/webp'),
      this.storageService.uploadBuffer(`${basePath}-render_ready.jpg`, renderReady, 'image/jpeg'),
    ]);

    media.variants = { thumbnail: thumbnailUrl, preview: previewUrl, render_ready: renderReadyUrl };
    await this.postMediaRepository.save(media);

    const post = await this.postsRepository.findOne({ where: { id: media.postId } });
    if (!post) return;

    const isPrimaryMedia =
      media.kind === PRIMARY_KIND_BY_FORMAT[post.format] && media.orderIndex === 0;

    // Só dispara a IA uma vez, quando a mídia primária termina — as demais
    // (ex: slides 2+ de um carrossel) processam em paralelo sem re-disparar
    // análise (evitaria N chamadas de IA redundantes pro mesmo post).
    if (isPrimaryMedia) {
      await this.aiQueue.add('analyze-post', { postId: post.id });
    }
  }

  onFailed(job: Job<MediaProcessingJobData>, error: Error) {
    this.logger.error(`media-processing falhou pra mídia ${job.data.postMediaId}: ${error.message}`);
  }
}
