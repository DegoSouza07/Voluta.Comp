import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { MediaProcessingProcessor } from './media-processing.processor';
import { StorageService } from '../storage.service';
import { PostMedia, PostMediaKind } from '../entities/post-media.entity';
import { Post } from '../../posts/entities/post.entity';
import { PostFormat } from '../../../common/enums/post-format.enum';
import { createMockRepository, MockRepository } from '../../../common/testing/mock-repository';

jest.mock('sharp', () => {
  const chain = {
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-image-bytes')),
  };
  return { __esModule: true, default: jest.fn(() => chain) };
});

describe('MediaProcessingProcessor', () => {
  let processor: MediaProcessingProcessor;
  let mediaRepo: MockRepository<PostMedia>;
  let postsRepo: MockRepository<Post>;
  let storage: { downloadBuffer: jest.Mock; uploadBuffer: jest.Mock; keyFromPublicUrl: jest.Mock };
  let aiQueue: { add: jest.Mock };

  beforeEach(async () => {
    mediaRepo = createMockRepository<PostMedia>();
    postsRepo = createMockRepository<Post>();
    storage = {
      downloadBuffer: jest.fn().mockResolvedValue(Buffer.from('original-bytes')),
      uploadBuffer: jest.fn().mockImplementation((key: string) => Promise.resolve(`https://cdn.test/${key}`)),
      keyFromPublicUrl: jest.fn().mockReturnValue('posts/post-1/cover-0.jpg'),
    };
    aiQueue = { add: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        MediaProcessingProcessor,
        { provide: StorageService, useValue: storage },
        { provide: getRepositoryToken(PostMedia), useValue: mediaRepo },
        { provide: getRepositoryToken(Post), useValue: postsRepo },
        { provide: getQueueToken('ai-analysis'), useValue: aiQueue },
      ],
    }).compile();

    processor = module.get(MediaProcessingProcessor);
  });

  it('descarta o job silenciosamente se a mídia foi apagada entre o enqueue e o processamento', async () => {
    mediaRepo.findOne.mockResolvedValue(null);
    await expect(processor.process({ data: { postMediaId: 'sumiu' } } as any)).resolves.toBeUndefined();
    expect(storage.downloadBuffer).not.toHaveBeenCalled();
  });

  it('gera e salva as 3 variantes (thumbnail/preview/render_ready)', async () => {
    mediaRepo.findOne.mockResolvedValue({
      id: 'media-1', postId: 'post-1', kind: PostMediaKind.COVER, orderIndex: 0,
      originalUrl: 'https://cdn.test/posts/post-1/cover-0.jpg',
    });
    mediaRepo.save.mockImplementation((m: any) => Promise.resolve(m));
    postsRepo.findOne.mockResolvedValue({ id: 'post-1', format: PostFormat.REEL });

    await processor.process({ data: { postMediaId: 'media-1' } } as any);

    const savedMedia = mediaRepo.save.mock.calls[0][0];
    expect(savedMedia.variants.thumbnail).toContain('thumbnail.webp');
    expect(savedMedia.variants.preview).toContain('preview.webp');
    expect(savedMedia.variants.render_ready).toContain('render_ready.jpg');
  });

  it('dispara a análise de IA quando a mídia processada é a PRIMÁRIA do formato (cover, pro Reel)', async () => {
    mediaRepo.findOne.mockResolvedValue({
      id: 'media-1', postId: 'post-1', kind: PostMediaKind.COVER, orderIndex: 0,
      originalUrl: 'https://cdn.test/x.jpg',
    });
    mediaRepo.save.mockImplementation((m: any) => Promise.resolve(m));
    postsRepo.findOne.mockResolvedValue({ id: 'post-1', format: PostFormat.REEL });

    await processor.process({ data: { postMediaId: 'media-1' } } as any);

    expect(aiQueue.add).toHaveBeenCalledWith('analyze-post', { postId: 'post-1' });
  });

  it('NÃO dispara a análise de IA quando a mídia processada não é a primária (ex: frame "reel" de um post Reel)', async () => {
    mediaRepo.findOne.mockResolvedValue({
      id: 'media-2', postId: 'post-1', kind: PostMediaKind.REEL, orderIndex: 0,
      originalUrl: 'https://cdn.test/x.jpg',
    });
    mediaRepo.save.mockImplementation((m: any) => Promise.resolve(m));
    postsRepo.findOne.mockResolvedValue({ id: 'post-1', format: PostFormat.REEL });

    await processor.process({ data: { postMediaId: 'media-2' } } as any);

    expect(aiQueue.add).not.toHaveBeenCalled();
  });

  it('NÃO dispara a análise de IA de novo pro 2º+ slide de um carrossel (evita chamadas de IA redundantes)', async () => {
    mediaRepo.findOne.mockResolvedValue({
      id: 'media-3', postId: 'post-1', kind: PostMediaKind.SLIDE, orderIndex: 1,
      originalUrl: 'https://cdn.test/x.jpg',
    });
    mediaRepo.save.mockImplementation((m: any) => Promise.resolve(m));
    postsRepo.findOne.mockResolvedValue({ id: 'post-1', format: PostFormat.CARROSSEL });

    await processor.process({ data: { postMediaId: 'media-3' } } as any);

    expect(aiQueue.add).not.toHaveBeenCalled();
  });
});
