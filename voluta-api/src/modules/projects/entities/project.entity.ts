import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectStatus } from '../../../common/enums/project-status.enum';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column()
  title: string;

  @Column({ name: 'reference_month', type: 'date' })
  referenceMonth: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.PLANNING })
  status: ProjectStatus;

  // Foto de capa da página 1 do Plano Visual — escolhida à parte do grid,
  // não é necessariamente um dos posts (ver template cover.hbs, Etapa 5).
  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Index()
  @Column({ name: 'public_slug', unique: true, nullable: true })
  publicSlug: string | null;

  @Column({ name: 'pdf_url', type: 'text', nullable: true })
  pdfUrl: string | null;

  @Column({ name: 'pdf_generated_at', type: 'timestamptz', nullable: true })
  pdfGeneratedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => Post, (post) => post.project)
  posts: Post[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
