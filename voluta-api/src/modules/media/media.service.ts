import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { StorageService } from './storage.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { PostMedia, PostMediaKind } from './entities/post-media.entity';
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

    // kind=reel é a ÚNICA mídia que pode ser vídeo — todo o resto
    // (cover/slide) é sempre imagem. Sem essa checagem, um vídeo
    // enviado pro slot errado (ex: usuário escolheu "Todos os arquivos"
    // no seletor do sistema operacional, ignorando o filtro do
    // navegador) é aceito, o worker tenta rodar Sharp em cima dele,
    // falha silenciosamente, e o slot fica preso em "processando..."
    // pra sempre, sem nenhum erro visível pro usuário. Rejeitar aqui, na
    // hora de pedir a URL de upload, é bem mais barato de diagnosticar
    // do que deixar o job falhar horas depois numa fila que ninguém tá
    // olhando.
    const isVideoContentType = dto.contentType.startsWith('video/');
    if (dto.kind === PostMediaKind.REEL && !isVideoContentType) {
      throw new BadRequestException(
        `O slot de Reel espera um vídeo (video/mp4 ou video/quicktime), recebido: ${dto.contentType}.`,
      );
    }
    if (dto.kind !== PostMediaKind.REEL && isVideoContentType) {
      throw new BadRequestException(
        `O slot "${dto.kind}" espera uma imagem, recebido um vídeo (${dto.contentType}). Só o slot de Reel aceita vídeo.`,
      );
    }

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

  // Remove um slot de mídia — usado pelo carrossel pra tirar um slide do
  // meio da lista (cover/reel de um Reel e o único slide de um Estático
  // não têm "remover", só "trocar" — a UI não oferece esse botão pra
  // esses casos, mas o endpoint em si não impede).
  async deleteMedia(postMediaId: string): Promise<void> {
    const media = await this.postMediaRepository.findOne({ where: { id: postMediaId } });
    if (!media) throw new NotFoundException(`Mídia ${postMediaId} não encontrada.`);
    // Não apaga o arquivo do bucket aqui de propósito — manter o objeto
    // órfão no Storage é inofensivo (não aparece em lugar nenhum sem o
    // registro no banco) e evita acoplar essa operação a uma chamada de
    // rede que pode falhar. Limpeza de órfãos no bucket é candidata a job
    // periódico separado, não a este endpoint.
    await this.postMediaRepository.remove(media);
  }
}
