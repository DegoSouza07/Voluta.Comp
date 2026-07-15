import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiAnalysisProcessor } from './ai-analysis.processor';
import { AiService } from '../ai.service';
import { Post } from '../../posts/entities/post.entity';
import { PostMedia, PostMediaKind } from '../../media/entities/post-media.entity';
import { PostFormat } from '../../../common/enums/post-format.enum';
import { PostStatus } from '../../../common/enums/post-status.enum';
import { FunnelStage } from '../../../common/enums/funnel-stage.enum';
import { createMockRepository, MockRepository } from '../../../common/testing/mock-repository';

describe('AiAnalysisProcessor', () => {
  let processor: AiAnalysisProcessor;
  let postsRepo: MockRepository<Post>;
  let mediaRepo: MockRepository<PostMedia>;
  let aiService: { analyzePost: jest.Mock };

  beforeEach(async () => {
    postsRepo = createMockRepository<Post>();
    mediaRepo = createMockRepository<PostMedia>();
    aiService = { analyzePost: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AiAnalysisProcessor,
        { provide: AiService, useValue: aiService },
        { provide: getRepositoryToken(Post), useValue: postsRepo },
        { provide: getRepositoryToken(PostMedia), useValue: mediaRepo },
      ],
    }).compile();

    processor = module.get(AiAnalysisProcessor);
  });

  it('descarta o job se o post não existe mais', async () => {
    postsRepo.findOne.mockResolvedValue(null);
    await processor.process({ data: { postId: 'sumiu' } } as any);
    expect(aiService.analyzePost).not.toHaveBeenCalled();
  });

  it('descarta o job se a mídia primária ainda não tem preview processado (evita mandar URL quebrada pra IA)', async () => {
    postsRepo.findOne.mockResolvedValue({ id: 'p1', format: PostFormat.REEL, project: { client: {} } });
    mediaRepo.findOne.mockResolvedValue({ variants: {} });

    await processor.process({ data: { postId: 'p1' } } as any);

    expect(aiService.analyzePost).not.toHaveBeenCalled();
  });

  it('busca a mídia primária CORRETA por formato: cover pro Reel', async () => {
    postsRepo.findOne.mockResolvedValue({ id: 'p1', format: PostFormat.REEL, project: { client: {} } });
    mediaRepo.findOne.mockResolvedValue({ variants: { preview: 'https://cdn.test/preview.jpg' } });
    aiService.analyzePost.mockResolvedValue({
      caption: 'x', editorialLine: 'y', funnelStage: 'descoberta', emotion: 'z', tags: [],
    });
    postsRepo.save.mockImplementation((p: any) => Promise.resolve(p));

    await processor.process({ data: { postId: 'p1' } } as any);

    expect(mediaRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ kind: PostMediaKind.COVER, orderIndex: 0 }) }),
    );
  });

  it('busca a mídia primária CORRETA por formato: slide 0 pro Carrossel', async () => {
    postsRepo.findOne.mockResolvedValue({ id: 'p1', format: PostFormat.CARROSSEL, project: { client: {} } });
    mediaRepo.findOne.mockResolvedValue({ variants: { preview: 'https://cdn.test/preview.jpg' } });
    aiService.analyzePost.mockResolvedValue({
      caption: 'x', editorialLine: 'y', funnelStage: 'descoberta', emotion: 'z', tags: [],
    });
    postsRepo.save.mockImplementation((p: any) => Promise.resolve(p));

    await processor.process({ data: { postId: 'p1' } } as any);

    expect(mediaRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ kind: PostMediaKind.SLIDE, orderIndex: 0 }) }),
    );
  });

  it('preenche o post com o resultado da análise e marca AI_GENERATED', async () => {
    postsRepo.findOne.mockResolvedValue({
      id: 'p1', format: PostFormat.ESTATICO, publishDate: '2026-07-08',
      project: { client: { name: 'Casa Pla', toneOfVoice: 'caloroso' } },
    });
    mediaRepo.findOne.mockResolvedValue({ variants: { preview: 'https://cdn.test/preview.jpg' } });
    aiService.analyzePost.mockResolvedValue({
      caption: 'Legenda gerada', editorialLine: 'Bastidores', funnelStage: 'consideracao',
      emotion: 'Encantamento', tags: ['a', 'b'],
    });
    postsRepo.save.mockImplementation((p: any) => Promise.resolve(p));

    await processor.process({ data: { postId: 'p1' } } as any);

    const finalSave = postsRepo.save.mock.calls[postsRepo.save.mock.calls.length - 1][0];
    expect(finalSave.caption).toBe('Legenda gerada');
    expect(finalSave.funnelStage).toBe(FunnelStage.CONSIDERACAO);
    expect(finalSave.status).toBe(PostStatus.AI_GENERATED);
    expect(finalSave.weekday).toBe('QUA'); // 2026-07-08 é quarta-feira
  });

  it('usa o tom de voz padrão quando o cliente não tem toneOfVoice configurado', async () => {
    postsRepo.findOne.mockResolvedValue({
      id: 'p1', format: PostFormat.ESTATICO, publishDate: null,
      project: { client: { name: 'Casa Pla', toneOfVoice: null } },
    });
    mediaRepo.findOne.mockResolvedValue({ variants: { preview: 'https://cdn.test/preview.jpg' } });
    aiService.analyzePost.mockResolvedValue({
      caption: 'x', editorialLine: 'y', funnelStage: 'descoberta', emotion: 'z', tags: [],
    });
    postsRepo.save.mockImplementation((p: any) => Promise.resolve(p));

    await processor.process({ data: { postId: 'p1' } } as any);

    expect(aiService.analyzePost).toHaveBeenCalledWith(
      expect.objectContaining({ toneOfVoice: expect.any(String) }),
    );
  });
});
