import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { PostStatus } from '../../common/enums/post-status.enum';
import { PostFormat } from '../../common/enums/post-format.enum';
import { createMockRepository, MockRepository } from '../../common/testing/mock-repository';

describe('PostsService', () => {
  let service: PostsService;
  let repo: MockRepository<Post>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    repo = createMockRepository<Post>();
    dataSource = { transaction: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: repo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  describe('createDraft', () => {
    it('cria o post em DRAFT, sem mídia, no formato e posição informados', async () => {
      repo.create!.mockReturnValue({ format: PostFormat.REEL, orderIndex: 3 });
      repo.save!.mockResolvedValue({ id: 'p1', format: PostFormat.REEL, orderIndex: 3, status: PostStatus.DRAFT });

      const result = await service.createDraft('proj-1', { format: PostFormat.REEL, orderIndex: 3 });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', orderIndex: 3, format: PostFormat.REEL, status: PostStatus.DRAFT }),
      );
      expect(result.status).toBe(PostStatus.DRAFT);
    });
  });

  describe('findOne', () => {
    it('lança NotFoundException quando o post não existe', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('nao-existe')).rejects.toThrow(NotFoundException);
    });

    it('retorna o post quando encontrado', async () => {
      const post = { id: 'p1' };
      repo.findOne!.mockResolvedValue(post);
      await expect(service.findOne('p1')).resolves.toBe(post);
    });
  });

  describe('update', () => {
    it('deriva o weekday em português a partir de publishDate (segunda-feira)', async () => {
      repo.findOne!.mockResolvedValue({ id: 'p1', caption: null });
      repo.save!.mockImplementation((p) => Promise.resolve(p));

      const result = await service.update('p1', { publishDate: '2026-07-06' }); // segunda-feira

      expect(result.weekday).toBe('SEG');
    });

    it('não mexe no weekday se publishDate não foi enviado no update', async () => {
      repo.findOne!.mockResolvedValue({ id: 'p1', weekday: 'QUA' });
      repo.save!.mockImplementation((p) => Promise.resolve(p));

      const result = await service.update('p1', { caption: 'nova legenda' });

      expect(result.weekday).toBe('QUA');
    });
  });

  describe('reorder', () => {
    it('faz o update em duas fases (offset negativo, depois final) pra nunca violar a constraint UNIQUE durante a troca', async () => {
      const managerUpdate = jest.fn().mockResolvedValue(undefined);
      dataSource.transaction.mockImplementation(async (cb) => cb({ update: managerUpdate }));
      repo.find!.mockResolvedValue([{ id: 'a', orderIndex: 0 }, { id: 'b', orderIndex: 1 }]);

      const items = [
        { id: 'a', orderIndex: 1 },
        { id: 'b', orderIndex: 0 },
      ];
      await service.reorder('proj-1', { items });

      const calledArgs = managerUpdate.mock.calls.map((call) => call[2]);
      // fase 1: os dois primeiros updates devem usar índices negativos (nunca colidem entre si nem com os existentes)
      expect(calledArgs[0].orderIndex).toBeLessThan(0);
      expect(calledArgs[1].orderIndex).toBeLessThan(0);
      // fase 2: os dois últimos updates aplicam os índices finais pedidos
      expect(calledArgs[2].orderIndex).toBe(1);
      expect(calledArgs[3].orderIndex).toBe(0);
    });

    it('escopa cada update por projectId (nunca reordena post de outro projeto por engano)', async () => {
      const managerUpdate = jest.fn().mockResolvedValue(undefined);
      dataSource.transaction.mockImplementation(async (cb) => cb({ update: managerUpdate }));
      repo.find!.mockResolvedValue([]);

      await service.reorder('proj-1', { items: [{ id: 'a', orderIndex: 0 }] });

      for (const call of managerUpdate.mock.calls) {
        expect(call[1]).toEqual(expect.objectContaining({ projectId: 'proj-1' }));
      }
    });
  });

  describe('markReadyToRender', () => {
    it('muda o status pra READY_TO_RENDER', async () => {
      repo.findOne!.mockResolvedValue({ id: 'p1', status: PostStatus.AI_GENERATED });
      repo.save!.mockImplementation((p) => Promise.resolve(p));

      const result = await service.markReadyToRender('p1');

      expect(result.status).toBe(PostStatus.READY_TO_RENDER);
    });
  });
});
