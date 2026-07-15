import { PdfDataMapper } from './pdf-data.mapper';
import { PostFormat } from '../../common/enums/post-format.enum';
import { FunnelStage } from '../../common/enums/funnel-stage.enum';
import { PostMediaKind } from '../media/entities/post-media.entity';

function buildMedia(kind: PostMediaKind, orderIndex: number, seed: string) {
  return {
    id: `media-${seed}`,
    postId: 'post-1',
    kind,
    orderIndex,
    originalUrl: `https://cdn.test/${seed}-original.jpg`,
    variants: {
      thumbnail: `https://cdn.test/${seed}-thumb.webp`,
      preview: `https://cdn.test/${seed}-preview.webp`,
      render_ready: `https://cdn.test/${seed}-render.jpg`,
    },
    createdAt: new Date(),
  } as any;
}

function buildProject(posts: any[]) {
  return {
    id: 'proj-1',
    referenceMonth: '2026-07-01',
    coverImageUrl: null,
    client: {
      name: 'Casa Pla',
      slug: 'casapla',
      instagramHandle: 'vo.lu.ta',
      websiteLabel: 'voluta.company',
    },
    posts,
  } as any;
}

describe('PdfDataMapper', () => {
  let mapper: PdfDataMapper;

  beforeEach(() => {
    mapper = new PdfDataMapper();
  });

  it('formata o mês/ano de referência em português', () => {
    const ctx = mapper.toTemplateContext(buildProject([]));
    expect(ctx.project.referenceMonthLabel).toBe('Julho, 2026');
    expect(ctx.project.yearShort).toBe('26');
  });

  it('mostra o ícone de play SÓ no formato Reel (regressão do bug real encontrado)', () => {
    const posts = [
      {
        id: 'post-1', orderIndex: 1, format: PostFormat.REEL, publishDate: '2026-07-08',
        weekday: 'QUA', caption: 'Legenda do reel', editorialLine: 'X', emotion: 'Y',
        funnelStage: FunnelStage.DESCOBERTA,
        media: [buildMedia(PostMediaKind.COVER, 0, 'cover'), buildMedia(PostMediaKind.REEL, 0, 'reel')],
      },
      {
        id: 'post-2', orderIndex: 2, format: PostFormat.CARROSSEL, publishDate: '2026-07-09',
        weekday: 'QUI', caption: 'Legenda do carrossel', editorialLine: 'X', emotion: 'Y',
        funnelStage: FunnelStage.CONSIDERACAO,
        media: [buildMedia(PostMediaKind.SLIDE, 0, 'slide0')],
      },
      {
        id: 'post-3', orderIndex: 3, format: PostFormat.ESTATICO, publishDate: '2026-07-10',
        weekday: 'SEX', caption: 'Legenda do estático', editorialLine: 'X', emotion: 'Y',
        funnelStage: FunnelStage.DECISAO,
        media: [buildMedia(PostMediaKind.SLIDE, 0, 'slide0')],
      },
    ];

    const ctx = mapper.toTemplateContext(buildProject(posts));

    expect(ctx.posts[0].showPlayIcon).toBe(true);  // reel
    expect(ctx.posts[1].showPlayIcon).toBe(false); // carrossel
    expect(ctx.posts[2].showPlayIcon).toBe(false); // estático
  });

  it('monta coverFrameUrl e reelFrameUrl a partir das mídias kind=cover e kind=reel', () => {
    const posts = [{
      id: 'post-1', orderIndex: 1, format: PostFormat.REEL, publishDate: '2026-07-08',
      weekday: 'QUA', caption: 'Oi', editorialLine: 'X', emotion: 'Y', funnelStage: FunnelStage.DESCOBERTA,
      media: [buildMedia(PostMediaKind.COVER, 0, 'cover'), buildMedia(PostMediaKind.REEL, 0, 'reel')],
    }];

    const ctx = mapper.toTemplateContext(buildProject(posts)) as any;

    expect(ctx.posts[0].coverFrameUrl).toBe('https://cdn.test/cover-render.jpg');
    expect(ctx.posts[0].reelFrameUrl).toBe('https://cdn.test/reel-render.jpg');
  });

  it('reel sem mídia kind=reel ainda processada cai pro frame de capa (degrada, não quebra)', () => {
    const posts = [{
      id: 'post-1', orderIndex: 1, format: PostFormat.REEL, publishDate: '2026-07-08',
      weekday: 'QUA', caption: 'Oi', editorialLine: 'X', emotion: 'Y', funnelStage: FunnelStage.DESCOBERTA,
      media: [buildMedia(PostMediaKind.COVER, 0, 'cover')], // reel ainda não processou
    }];

    const ctx = mapper.toTemplateContext(buildProject(posts)) as any;

    expect(ctx.posts[0].reelFrameUrl).toBe(ctx.posts[0].coverFrameUrl);
  });

  it('monta os N slides do carrossel ordenados por orderIndex, mesmo fora de ordem na origem', () => {
    const posts = [{
      id: 'post-1', orderIndex: 1, format: PostFormat.CARROSSEL, publishDate: '2026-07-08',
      weekday: 'QUA', caption: 'Oi', editorialLine: 'X', emotion: 'Y', funnelStage: FunnelStage.DESCOBERTA,
      media: [
        buildMedia(PostMediaKind.SLIDE, 2, 'slide2'),
        buildMedia(PostMediaKind.SLIDE, 0, 'slide0'),
        buildMedia(PostMediaKind.SLIDE, 1, 'slide1'),
      ],
    }];

    const ctx = mapper.toTemplateContext(buildProject(posts)) as any;

    expect(ctx.posts[0].slides.map((s: any) => s.url)).toEqual([
      'https://cdn.test/slide0-render.jpg',
      'https://cdn.test/slide1-render.jpg',
      'https://cdn.test/slide2-render.jpg',
    ]);
  });

  it('ordena os posts pelo orderIndex, independente da ordem de chegada', () => {
    const posts = [
      { id: 'b', orderIndex: 2, format: PostFormat.ESTATICO, publishDate: null, weekday: null, caption: null, editorialLine: null, emotion: null, funnelStage: null, media: [] },
      { id: 'a', orderIndex: 1, format: PostFormat.ESTATICO, publishDate: null, weekday: null, caption: null, editorialLine: null, emotion: null, funnelStage: null, media: [] },
    ];

    const ctx = mapper.toTemplateContext(buildProject(posts));

    expect(ctx.posts.map((p) => p.orderIndex)).toEqual([1, 2]);
  });

  it('capitaliza o funnelStage pro rótulo em português e lida com null', () => {
    const posts = [
      { id: 'a', orderIndex: 1, format: PostFormat.ESTATICO, publishDate: null, weekday: null, caption: null, editorialLine: null, emotion: null, funnelStage: FunnelStage.CONSIDERACAO, media: [] },
      { id: 'b', orderIndex: 2, format: PostFormat.ESTATICO, publishDate: null, weekday: null, caption: null, editorialLine: null, emotion: null, funnelStage: null, media: [] },
    ];

    const ctx = mapper.toTemplateContext(buildProject(posts));

    expect(ctx.posts[0].funnelStageLabel).toBe('Consideração');
    expect(ctx.posts[1].funnelStageLabel).toBe('');
  });

  it('quebra a legenda em parágrafos por linha dupla e ignora parágrafos vazios', () => {
    const posts = [{
      id: 'a', orderIndex: 1, format: PostFormat.ESTATICO, publishDate: null, weekday: null,
      caption: 'Primeiro parágrafo.\n\n\nSegundo parágrafo.\n\nTerceiro.',
      editorialLine: null, emotion: null, funnelStage: null, media: [],
    }];

    const ctx = mapper.toTemplateContext(buildProject(posts));

    expect(ctx.posts[0].captionParagraphs).toEqual([
      'Primeiro parágrafo.',
      'Segundo parágrafo.',
      'Terceiro.',
    ]);
  });

  it('trunca o texto do badge de capa em 90 caracteres', () => {
    const longLine = 'A'.repeat(120);
    const posts = [{
      id: 'a', orderIndex: 1, format: PostFormat.ESTATICO, publishDate: null, weekday: null,
      caption: longLine, editorialLine: null, emotion: null, funnelStage: null, media: [],
    }];

    const ctx = mapper.toTemplateContext(buildProject(posts));

    expect(ctx.posts[0].coverBadgeText.length).toBe(90);
    expect(ctx.posts[0].coverBadgeText.endsWith('...')).toBe(true);
  });

  it('formata publishDate como D/M sem zero à esquerda', () => {
    const posts = [{
      id: 'a', orderIndex: 1, format: PostFormat.ESTATICO, publishDate: '2026-07-08', weekday: 'QUA',
      caption: null, editorialLine: null, emotion: null, funnelStage: null, media: [],
    }];

    const ctx = mapper.toTemplateContext(buildProject(posts));

    expect(ctx.posts[0].publishDateShort).toBe('8/7');
  });

  it('usa a imagem do primeiro post como fallback de capa quando o projeto não tem coverImageUrl', () => {
    const posts = [{
      id: 'a', orderIndex: 1, format: PostFormat.ESTATICO, publishDate: null, weekday: null,
      caption: null, editorialLine: null, emotion: null, funnelStage: null,
      media: [buildMedia(PostMediaKind.SLIDE, 0, 'capa-fallback')],
    }];

    const ctx = mapper.toTemplateContext(buildProject(posts));

    expect(ctx.project.coverImageUrl).toBe('https://cdn.test/capa-fallback-render.jpg');
  });
});
