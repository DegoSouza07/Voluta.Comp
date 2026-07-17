import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { UpdatePostDto } from './dto/update-post.dto';
import { ReorderPostsDto } from './dto/reorder-posts.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { PostStatus } from '../../common/enums/post-status.enum';

const WEEKDAY_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly postsRepository: Repository<Post>,
    private readonly dataSource: DataSource,
  ) {}

  // Cria o "casco" do post (formato + posição no grid), sem mídia ainda.
  // A mídia é anexada depois via MediaService (1 ou mais uploads, conforme
  // o formato — ver PostMedia).
  createDraft(projectId: string, dto: CreatePostDto): Promise<Post> {
    return this.postsRepository.save(
      this.postsRepository.create({
        projectId,
        orderIndex: dto.orderIndex,
        format: dto.format,
        status: PostStatus.DRAFT,
      }),
    );
  }

  findByProject(projectId: string): Promise<Post[]> {
    return this.postsRepository.find({
      where: { projectId },
      order: { orderIndex: 'ASC' },
      relations: { media: true },
    });
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({ where: { id } });
    if (!post) throw new NotFoundException(`Post ${id} não encontrado.`);
    return post;
  }

  async findOneWithMedia(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({ where: { id }, relations: { media: true } });
    if (!post) throw new NotFoundException(`Post ${id} não encontrado.`);
    return post;
  }

  async update(id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.findOneWithMedia(id);
    Object.assign(post, dto);

    // weekday é derivado e cacheado (ver Etapa 2) — nunca calculado no
    // template de render, pra manter o worker de PDF livre de lógica de data.
    if (dto.publishDate) {
      post.weekday = WEEKDAY_LABELS[new Date(`${dto.publishDate}T12:00:00Z`).getUTCDay()];
    }

    return this.postsRepository.save(post);
  }

  // Uma única transação pra reordenar o grid inteiro — evita estado
  // intermediário inconsistente se a request cair no meio (Etapa 4).
  //
  // Duas fases são necessárias: um UPDATE direto post a post pode violar a
  // constraint UNIQUE(project_id, order_index) no meio do caminho sempre que
  // duas posições trocam entre si (ex: post A vai de 0→1 enquanto post B
  // ainda está em 1). Por isso movemos tudo pra um intervalo negativo
  // (garantidamente livre) antes de aplicar os índices finais.
  async reorder(projectId: string, dto: ReorderPostsDto): Promise<Post[]> {
    await this.dataSource.transaction(async (manager) => {
      await Promise.all(
        dto.items.map((item, i) =>
          manager.update(Post, { id: item.id, projectId }, { orderIndex: -(i + 1) }),
        ),
      );
      await Promise.all(
        dto.items.map((item) =>
          manager.update(Post, { id: item.id, projectId }, { orderIndex: item.orderIndex }),
        ),
      );
    });
    return this.findByProject(projectId);
  }

  async markReadyToRender(id: string): Promise<Post> {
    const post = await this.findOne(id);
    post.status = PostStatus.READY_TO_RENDER;
    return this.postsRepository.save(post);
  }
}
