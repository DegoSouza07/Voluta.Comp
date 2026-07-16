import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';
import { PostMedia, PostMediaKind } from './entities/post-media.entity';
import { Post } from '../posts/entities/post.entity';
import { createMockRepository, MockRepository } from '../../common/testing/mock-repository';

describe('MediaService', () => {
  let service: MediaService;
  let postsRepo: MockRepository<Post>;
  let mediaRepo: MockRepository<PostMedia>;
  let storage: { createUploadUrl: jest.Mock; publicUrlFor: jest.Mock };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    postsRepo = createMockRepository<Post>();
    mediaRepo = createMockRepository<PostMedia>();
    storage = {
      createUploadUrl: jest.fn().mockResolvedValue('https://signed-url.test'),
      publicUrlFor: jest.fn((key: string) => `https://cdn.test/${key}`),
    };
    queue = { add: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: StorageService, useValue: storage },
        { provide: getRepositoryToken(Post), useValue: postsRepo },
        { provide: getRepositoryToken(PostMedia), useValue: mediaRepo },
        { provide: getQueueToken('media-processing'), useValue: queue },
      ],
    }).compile();

    service = module.get(MediaService);
  });

  describe('createUploadUrl', () => {
    it('lança NotFoundException se o post não existe', async () => {
      postsRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createUploadUrl('post-inexistente', {
          filename: 'foto.jpg', contentType: 'image/jpeg', kind: PostMediaKind.COVER, orderIndex: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita vídeo enviado pro slot de capa (cover) — regressão real: sem isso o slot ficava preso em "processando" pra sempre, sem erro visível', async () => {
      postsRepo.findOne.mockResolvedValue({ id: 'post-1' });
      await expect(
        service.createUploadUrl('post-1', {
          filename: 'video.mp4', contentType: 'video/mp4', kind: PostMediaKind.COVER, orderIndex: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita vídeo enviado pro slide de um carrossel', async () => {
      postsRepo.findOne.mockResolvedValue({ id: 'post-1' });
      await expect(
        service.createUploadUrl('post-1', {
          filename: 'video.mp4', contentType: 'video/mp4', kind: PostMediaKind.SLIDE, orderIndex: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita imagem enviada pro slot de reel (que espera vídeo)', async () => {
      postsRepo.findOne.mockResolvedValue({ id: 'post-1' });
      await expect(
        service.createUploadUrl('post-1', {
          filename: 'foto.jpg', contentType: 'image/jpeg', kind: PostMediaKind.REEL, orderIndex: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('aceita vídeo no slot de reel — é o único kind que pode ser vídeo', async () => {
      postsRepo.findOne.mockResolvedValue({ id: 'post-1' });
      mediaRepo.findOne.mockResolvedValue(null);
      mediaRepo.create.mockImplementation((d: any) => d);
      mediaRepo.save.mockImplementation((m: any) => Promise.resolve({ id: 'media-1', ...m }));

      const result = await service.createUploadUrl('post-1', {
        filename: 'video.mp4', contentType: 'video/mp4', kind: PostMediaKind.REEL, orderIndex: 0,
      });

      expect(result.postMediaId).toBe('media-1');
    });

    it('cria um novo slot de PostMedia quando não existe ainda', async () => {
      postsRepo.findOne.mockResolvedValue({ id: 'post-1' });
      mediaRepo.findOne.mockResolvedValue(null);
      mediaRepo.create.mockImplementation((d: any) => d);
      mediaRepo.save.mockImplementation((m: any) => Promise.resolve({ id: 'media-1', ...m }));

      const result = await service.createUploadUrl('post-1', {
        filename: 'capa.jpg', contentType: 'image/jpeg', kind: PostMediaKind.COVER, orderIndex: 0,
      });

      expect(mediaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ postId: 'post-1', kind: PostMediaKind.COVER, orderIndex: 0 }),
      );
      expect(result.postMediaId).toBe('media-1');
      expect(result.uploadUrl).toBe('https://signed-url.test');
    });

    it('reseta as variantes ao reenviar no MESMO slot (evita PDF renderizar com imagem antiga)', async () => {
      postsRepo.findOne.mockResolvedValue({ id: 'post-1' });
      const existing = {
        id: 'media-1', postId: 'post-1', kind: PostMediaKind.COVER, orderIndex: 0,
        originalUrl: 'https://cdn.test/old.jpg', variants: { thumbnail: 'old-thumb.webp' },
      };
      mediaRepo.findOne.mockResolvedValue(existing);
      mediaRepo.save.mockImplementation((m: any) => Promise.resolve(m));

      const result = await service.createUploadUrl('post-1', {
        filename: 'capa-nova.jpg', contentType: 'image/jpeg', kind: PostMediaKind.COVER, orderIndex: 0,
      });

      expect(mediaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'media-1', variants: {} }),
      );
      expect(result.postMediaId).toBe('media-1');
    });

    it('a key do storage inclui o kind e o orderIndex (slots distintos não colidem)', async () => {
      postsRepo.findOne.mockResolvedValue({ id: 'post-1' });
      mediaRepo.findOne.mockResolvedValue(null);
      mediaRepo.create.mockImplementation((d: any) => d);
      mediaRepo.save.mockImplementation((m: any) => Promise.resolve({ id: 'media-2', ...m }));

      await service.createUploadUrl('post-1', {
        filename: 'slide.png', contentType: 'image/png', kind: PostMediaKind.SLIDE, orderIndex: 2,
      });

      expect(storage.createUploadUrl).toHaveBeenCalledWith(
        expect.stringContaining('slide-2'),
        'image/png',
      );
    });
  });

  describe('confirmUpload', () => {
    it('lança NotFoundException se a mídia não existe', async () => {
      mediaRepo.findOne.mockResolvedValue(null);
      await expect(service.confirmUpload('media-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('enfileira o processamento (nunca processa a imagem síncronamente na request)', async () => {
      mediaRepo.findOne.mockResolvedValue({ id: 'media-1' });
      const result = await service.confirmUpload('media-1');

      expect(queue.add).toHaveBeenCalledWith('process-media', { postMediaId: 'media-1' });
      expect(result).toEqual({ queued: true });
    });
  });

  describe('deleteMedia', () => {
    it('lança NotFoundException se a mídia não existe', async () => {
      mediaRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteMedia('media-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('remove o registro do banco (usado pra tirar um slide do carrossel)', async () => {
      const media = { id: 'media-1', kind: PostMediaKind.SLIDE, orderIndex: 2 };
      mediaRepo.findOne.mockResolvedValue(media);
      mediaRepo.remove.mockResolvedValue(media);

      await service.deleteMedia('media-1');

      expect(mediaRepo.remove).toHaveBeenCalledWith(media);
    });
  });
});
