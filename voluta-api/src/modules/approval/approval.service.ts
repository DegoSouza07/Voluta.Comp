import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { PostApproval, ApprovalAction } from './entities/post-approval.entity';
import { SubmitApprovalDto } from './dto/submit-approval.dto';
import { Post } from '../posts/entities/post.entity';
import { PostStatus } from '../../common/enums/post-status.enum';

@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(PostApproval) private readonly approvalsRepository: Repository<PostApproval>,
    @InjectRepository(Post) private readonly postsRepository: Repository<Post>,
    @InjectQueue('webhook-notify') private readonly webhookQueue: Queue,
  ) {}

  async submit(postId: string, dto: SubmitApprovalDto): Promise<PostApproval> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: { project: { client: true } },
    });
    if (!post) throw new NotFoundException(`Post ${postId} não encontrado.`);

    const approval = await this.approvalsRepository.save(
      this.approvalsRepository.create({ postId, ...dto }),
    );

    post.status =
      dto.action === ApprovalAction.APPROVED ? PostStatus.APPROVED : PostStatus.CHANGE_REQUESTED;
    await this.postsRepository.save(post);

    // Nunca chamamos Slack/Discord síncronamente aqui — se o serviço
    // terceiro estiver fora do ar, isso não pode travar a resposta ao
    // cliente final que só quer confirmar a aprovação (ver Etapa 6).
    await this.webhookQueue.add('post-approval-event', {
      eventType: dto.action === ApprovalAction.APPROVED ? 'post_approved' : 'change_requested',
      postId: post.id,
      postOrderIndex: post.orderIndex,
      projectTitle: post.project?.title,
      clientName: post.project?.client?.name,
      comment: dto.comment,
    });

    return approval;
  }

  findByPost(postId: string): Promise<PostApproval[]> {
    return this.approvalsRepository.find({
      where: { postId },
      order: { createdAt: 'DESC' },
    });
  }
}
