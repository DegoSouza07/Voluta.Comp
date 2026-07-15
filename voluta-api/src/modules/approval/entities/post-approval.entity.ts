import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Post } from '../../posts/entities/post.entity';

export enum ApprovalAction {
  APPROVED = 'approved',
  CHANGE_REQUESTED = 'change_requested',
}

// Tabela de eventos (append-only) — preserva histórico completo de idas e
// vindas de aprovação por post. Nunca sobrescrevemos um registro aqui
// (ver Etapa 2: auditoria de "o cliente já tinha aprovado isso antes?").
@Entity('post_approvals')
export class PostApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @Column({ type: 'enum', enum: ApprovalAction })
  action: ApprovalAction;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  // Texto livre informado no link público — não é um user_id, é só atribuição
  // informal de autoria do feedback (o portal não exige login, ver Etapa 6).
  @Column({ name: 'client_identifier' })
  clientIdentifier: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
