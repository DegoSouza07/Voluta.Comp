import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PostFormat } from '../../../common/enums/post-format.enum';
import { FunnelStage } from '../../../common/enums/funnel-stage.enum';
import { PostStatus } from '../../../common/enums/post-status.enum';
import { Project } from '../../projects/entities/project.entity';
import { PostMedia } from '../../media/entities/post-media.entity';

@Entity('posts')
@Unique('uq_project_order', ['projectId', 'orderIndex'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'order_index', type: 'int' })
  orderIndex: number;

  @Column({ type: 'enum', enum: PostFormat })
  format: PostFormat;

  @Column({ name: 'publish_date', type: 'date', nullable: true })
  publishDate: string | null;

  @Column({ nullable: true })
  weekday: string | null;

  // Mídia agora vive em post_media (1:N) — ver PostMedia. Um post pode ter
  // 0 (recém-criado), 1 (Estático) ou N mídias (Reel: cover+reel; Carrossel: N slides).
  @OneToMany(() => PostMedia, (media) => media.post)
  media: PostMedia[];

  @Column({ type: 'text', nullable: true })
  caption: string | null;

  @Column({ name: 'editorial_line', nullable: true })
  editorialLine: string | null;

  @Column({ name: 'funnel_stage', type: 'enum', enum: FunnelStage, nullable: true })
  funnelStage: FunnelStage | null;

  @Column({ nullable: true })
  emotion: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ name: 'user_context_input', type: 'text', nullable: true })
  userContextInput: string | null;

  @Column({ name: 'ai_raw_response', type: 'jsonb', nullable: true })
  aiRawResponse: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'enum', enum: PostStatus, default: PostStatus.DRAFT })
  status: PostStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
