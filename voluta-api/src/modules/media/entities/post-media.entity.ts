import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Post } from '../../posts/entities/post.entity';

export enum PostMediaKind {
  COVER = 'cover', // frame de capa do Reel (thumbnail estático)
  REEL = 'reel',   // frame/vídeo do Reel em si
  SLIDE = 'slide', // imagem de Carrossel (order_index 0..N-1) ou a única imagem do Estático
}

interface MediaVariants {
  thumbnail?: string;
  preview?: string;
  render_ready?: string;
}

/**
 * Resolve a lacuna 1:1 do schema original (Etapa 2): um post pode ter
 * várias mídias, não uma só. Reel = cover + reel; Carrossel = N slides;
 * Estático = 1 slide (order_index 0).
 */
@Entity('post_media')
@Unique('uq_post_media_slot', ['postId', 'kind', 'orderIndex'])
export class PostMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => Post, (post) => post.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @Column({ type: 'enum', enum: PostMediaKind })
  kind: PostMediaKind;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @Column({ name: 'original_url', type: 'text' })
  originalUrl: string;

  @Column({ type: 'jsonb', default: {} })
  variants: MediaVariants;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
