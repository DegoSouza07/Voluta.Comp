import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../../../common/enums/user-role.enum';
import { Client } from '../../clients/entities/client.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.VOLUTA_EDITOR })
  role: UserRole;

  // Null para client_viewer autenticado via magic link/portal público (Etapa 6)
  @Column({ name: 'password_hash', type: 'text', nullable: true, select: false })
  passwordHash: string | null;

  // Só preenchido quando role = client_viewer
  @Index()
  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string | null;

  // @JoinColumn aponta pra MESMA coluna física client_id acima — sem isso,
  // o TypeORM cria uma segunda coluna implícita "clientId" (camelCase,
  // sem underscore) por baixo dos panos, que não existe no Postgres e
  // quebra qualquer query que toque a relação (erro real encontrado
  // rodando e2e contra Postgres de verdade, não pego pelos unit tests
  // porque lá o repository é sempre mockado).
  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
