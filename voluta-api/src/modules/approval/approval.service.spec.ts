import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ApprovalService } from './approval.service';
import { PostApproval, ApprovalAction } from './entities/post-approval.entity';
import { Post } from '../posts/entities/post.entity';
import { PostStatus } from '../../common/enums/post-status.enum';
import { createMockRepository, MockRepository } from '../../common/testing/mock-repository';

describe('ApprovalService', () => {
  let service: ApprovalService;
  let approvalsRepo: MockRepository<PostApproval>;
  let postsRepo: MockRepository<Post>;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    approvalsRepo = createMockRepository<PostApproval>();
    postsRepo = createMockRepository<Post>();
    queue = { add: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ApprovalService,
        { provide: getRepositoryToken(PostApproval), useValue: approvalsRepo },
        { provide: getRepositoryToken(Post), useValue: postsRepo },
        { provide: getQueueToken('webhook-notify'), useValue: queue },
      ],
    }).compile();

    service = module.get(ApprovalService);
  });

  it('lança NotFoundException se o post não existe', async () => {
    postsRepo.findOne.mockResolvedValue(null);
    await expect(
      service.submit('post-inexistente', { action: ApprovalAction.APPROVED, clientIdentifier: 'a@b.com' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('marca o post como APPROVED quando a ação é approved', async () => {
    postsRepo.findOne.mockResolvedValue({ id: 'post-1', orderIndex: 1, project: { title: 'X', client: { name: 'Y' } } });
    approvalsRepo.create.mockImplementation((d: any) => d);
    approvalsRepo.save.mockImplementation((a: any) => Promise.resolve(a));
    postsRepo.save.mockImplementation((p: any) => Promise.resolve(p));

    await service.submit('post-1', { action: ApprovalAction.APPROVED, clientIdentifier: 'cliente@x.com' });

    expect(postsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PostStatus.APPROVED }));
  });

  it('marca o post como CHANGE_REQUESTED quando a ação é change_requested', async () => {
    postsRepo.findOne.mockResolvedValue({ id: 'post-1', orderIndex: 1, project: { title: 'X', client: { name: 'Y' } } });
    approvalsRepo.create.mockImplementation((d: any) => d);
    approvalsRepo.save.mockImplementation((a: any) => Promise.resolve(a));
    postsRepo.save.mockImplementation((p: any) => Promise.resolve(p));

    await service.submit('post-1', {
      action: ApprovalAction.CHANGE_REQUESTED,
      comment: 'Trocar a legenda',
      clientIdentifier: 'cliente@x.com',
    });

    expect(postsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PostStatus.CHANGE_REQUESTED }));
  });

  it('SEMPRE enfileira a notificação — nunca chama o Slack direto (não pode travar a resposta ao cliente)', async () => {
    postsRepo.findOne.mockResolvedValue({ id: 'post-1', orderIndex: 3, project: { title: 'Julho', client: { name: 'Casa Pla' } } });
    approvalsRepo.create.mockImplementation((d: any) => d);
    approvalsRepo.save.mockImplementation((a: any) => Promise.resolve(a));
    postsRepo.save.mockImplementation((p: any) => Promise.resolve(p));

    await service.submit('post-1', { action: ApprovalAction.APPROVED, clientIdentifier: 'x@y.com' });

    expect(queue.add).toHaveBeenCalledWith(
      'post-approval-event',
      expect.objectContaining({ eventType: 'post_approved', postId: 'post-1', postOrderIndex: 3 }),
    );
  });

  it('propaga o comentário no evento de webhook quando é pedido de ajuste', async () => {
    postsRepo.findOne.mockResolvedValue({ id: 'post-1', orderIndex: 1, project: { title: 'X', client: { name: 'Y' } } });
    approvalsRepo.create.mockImplementation((d: any) => d);
    approvalsRepo.save.mockImplementation((a: any) => Promise.resolve(a));
    postsRepo.save.mockImplementation((p: any) => Promise.resolve(p));

    await service.submit('post-1', {
      action: ApprovalAction.CHANGE_REQUESTED,
      comment: 'A cor da parede está errada',
      clientIdentifier: 'x@y.com',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'post-approval-event',
      expect.objectContaining({ eventType: 'change_requested', comment: 'A cor da parede está errada' }),
    );
  });
});
