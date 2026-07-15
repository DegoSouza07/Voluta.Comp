import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

interface BrandColors {
  primary?: string;
  secondary?: string;
  accentSoft?: string;
  [key: string]: string | undefined;
}

interface BrandFonts {
  display?: string;
  body?: string;
  [key: string]: string | undefined;
}

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  // Usados nos templates de renderização (Etapa 5) — rodapé e crédito de cada post.
  @Column({ name: 'instagram_handle', nullable: true })
  instagramHandle: string | null;

  @Column({ name: 'website_label', nullable: true })
  websiteLabel: string | null;

  @Column({ name: 'brand_colors', type: 'jsonb', default: {} })
  brandColors: BrandColors;

  @Column({ name: 'brand_fonts', type: 'jsonb', default: {} })
  brandFonts: BrandFonts;

  @Column({ name: 'tone_of_voice', type: 'text', nullable: true })
  toneOfVoice: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
