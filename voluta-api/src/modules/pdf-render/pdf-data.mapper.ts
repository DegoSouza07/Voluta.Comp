import { Injectable } from '@nestjs/common';
import { Project } from '../projects/entities/project.entity';
import { Post } from '../posts/entities/post.entity';
import { PostMedia, PostMediaKind } from '../media/entities/post-media.entity';
import { PostFormat } from '../../common/enums/post-format.enum';
import { FunnelStage } from '../../common/enums/funnel-stage.enum';

const MONTH_LABELS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  [FunnelStage.DESCOBERTA]: 'Descoberta',
  [FunnelStage.CONSIDERACAO]: 'Consideração',
  [FunnelStage.DECISAO]: 'Decisão',
};

const FALLBACK_IMAGE = '';

/**
 * Traduz as entidades do Postgres pro formato que os templates Handlebars
 * esperam (mesmo shape validado em voluta-templates/mock/plan-mock.json).
 *
 * Agora consome `post.media` (PostMedia[], 1:N) — a lacuna de schema
 * documentada anteriormente (Reel com 1 imagem só, Carrossel sem slides
 * de verdade) está resolvida: cada post carrega sua própria lista de
 * mídias por `kind` (cover/reel/slide) e `orderIndex`.
 */
@Injectable()
export class PdfDataMapper {
  toTemplateContext(project: Project) {
    return {
      client: this.mapClient(project),
      project: this.mapProject(project),
      posts: [...project.posts]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((post) => this.mapPost(post)),
    };
  }

  private mapClient(project: Project) {
    return {
      name: project.client.name,
      instagramHandle: project.client.instagramHandle ?? project.client.slug,
      websiteLabel: project.client.websiteLabel ?? `${project.client.slug}.com`,
    };
  }

  private mapProject(project: Project) {
    const date = new Date(`${project.referenceMonth}T12:00:00Z`);
    const firstPostImage = this.findMedia(project.posts[0]?.media ?? [], undefined, 0)?.variants
      ?.render_ready;
    return {
      referenceMonthLabel: `${MONTH_LABELS_PT[date.getUTCMonth()]}, ${date.getUTCFullYear()}`,
      yearShort: String(date.getUTCFullYear()).slice(-2),
      coverImageUrl: project.coverImageUrl ?? firstPostImage ?? FALLBACK_IMAGE,
    };
  }

  private mapPost(post: Post) {
    const media = post.media ?? [];
    const captionParagraphs = this.splitCaptionIntoParagraphs(post.caption);
    const coverBadgeText = this.firstSentence(post.caption);

    const base = {
      orderIndex: post.orderIndex,
      format: post.format,
      showPlayIcon: post.format === PostFormat.REEL,
      publishDateShort: this.formatPublishDateShort(post.publishDate),
      weekdayAbbr: post.weekday ?? '',
      coverBadgeText,
      captionParagraphs,
      creditLabel: post.format === PostFormat.REEL ? 'Vídeo' : 'Fotografia',
      editorialLine: post.editorialLine ?? '',
      emotion: post.emotion ?? '',
      funnelStageLabel: post.funnelStage ? FUNNEL_STAGE_LABELS[post.funnelStage] : '',
    };

    if (post.format === PostFormat.REEL) {
      const cover = this.findMedia(media, PostMediaKind.COVER, 0);
      const reel = this.findMedia(media, PostMediaKind.REEL, 0);
      const coverImage = cover?.variants.render_ready ?? FALLBACK_IMAGE;
      return {
        ...base,
        thumbnailUrl: cover?.variants.thumbnail ?? FALLBACK_IMAGE,
        coverFrameUrl: coverImage,
        reelFrameUrl: reel?.variants.render_ready ?? coverImage,
        coverBadgeVariant: '',
        onScreenCaption: coverBadgeText,
      };
    }

    if (post.format === PostFormat.CARROSSEL) {
      const slides = media
        .filter((m) => m.kind === PostMediaKind.SLIDE)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((m) => ({ url: m.variants.render_ready ?? FALLBACK_IMAGE }));
      return {
        ...base,
        thumbnailUrl: slides[0]?.url ?? FALLBACK_IMAGE,
        slides,
      };
    }

    // estático
    const slide = this.findMedia(media, PostMediaKind.SLIDE, 0);
    const image = slide?.variants.render_ready ?? FALLBACK_IMAGE;
    return {
      ...base,
      thumbnailUrl: slide?.variants.thumbnail ?? image,
      imageUrl: image,
    };
  }

  private findMedia(
    media: PostMedia[],
    kind: PostMediaKind | undefined,
    orderIndex: number,
  ): PostMedia | undefined {
    return media.find((m) => (kind ? m.kind === kind : true) && m.orderIndex === orderIndex);
  }

  private formatPublishDateShort(publishDate: string | null): string {
    if (!publishDate) return '';
    const date = new Date(`${publishDate}T12:00:00Z`);
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  }

  private splitCaptionIntoParagraphs(caption: string | null): string[] {
    if (!caption) return [];
    return caption
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  private firstSentence(caption: string | null): string {
    if (!caption) return '';
    const firstLine = caption.split(/\n/)[0];
    return firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;
  }
}
