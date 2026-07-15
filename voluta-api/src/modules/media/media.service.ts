import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { StorageService } from './storage.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { PostMedia } from './entities/post-media.entity';
import { Post } from '../posts/entities/post.entity';

@Injectable()
export class MediaService {
  constructor(
    private readonly storageService: StorageService,
    @InjectRepository(Post) private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostMedia) private readonly postMediaRepository: Repository<PostMedia>,
    @InjectQueue('media-processing') private readonly mediaQueue: Queue,
  ) {}

  // Cria (ou substitui) o slot de mídia do post — ex: kind=cover/orderIndex=0
  // pro frame de capa de um Reel, kind=slide/orderIndex=2 pro 3º item de um
  // Carrossel. O front-end faz o PUT direto pro bucket com a URL retornada
  // (Etapa 1: upload nunca passa pelo servidor de aplicação).
  async createUploadUrl(postId: string, dto: CreateUploadUrlDto) {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post ${postId} não encontrado.`);

    const extension = dto.filename.split('.').pop();
    const key = `posts/${postId}/${dto.kind}-${dto.orderIndex}.${extension}`;

    let media = await this.postMediaRepository.findOne({
      where: { postId, kind: dto.kind, orderIndex: dto.orderIndex },
    });
    const originalUrl = this.storageService.publicUrlFor(key);

    if (media) {
      // Reenvio no mesmo slot (usuário trocou a foto) — reseta as variantes
      // antigas, senão o PDF renderiza com a imagem velha até o worker rodar.
      media.originalUrl = originalUrl;
      media.variants = {};
    } else {
      media = this.postMediaRepository.create({
        postId,
        kind: dto.kind,
        orderIndex: dto.orderIndex,
        originalUrl,
        variants: {},
      });
    }
    media = await this.postMediaRepository.save(media);

    const uploadUrl = await this.storageService.createUploadUrl(key, dto.contentType);
    return { postMediaId: media.id, uploadUrl, originalUrl };
  }

  // Chamado pelo front após o PUT direto ao bucket ter concluído.
  async confirmUpload(postMediaId: string) {
    const media = await this.postMediaRepository.findOne({ where: { id: postMediaId } });
    if (!media) throw new NotFoundException(`Mídia ${postMediaId} não encontrada.`);

    await this.mediaQueue.add('process-media', { postMediaId });
    return { queued: true };
  }

  findByPost(postId: string): Promise<PostMedia[]> {
    return this.postMediaRepository.find({ where: { postId }, order: { kind: 'ASC', orderIndex: 'ASC' } });
  }
}
