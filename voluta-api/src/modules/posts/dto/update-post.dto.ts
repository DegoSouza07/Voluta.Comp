import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { FunnelStage } from '../../../common/enums/funnel-stage.enum';

// Update é o principal ponto de escrita de um post: é aqui que o editor
// da Voluta ajusta o que a IA sugeriu (Etapa 3) antes de renderizar.
export class UpdatePostDto {
  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  editorialLine?: string;

  @IsOptional()
  @IsEnum(FunnelStage)
  funnelStage?: FunnelStage;

  @IsOptional()
  @IsString()
  emotion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  publishDate?: string;

  @IsOptional()
  @IsString()
  userContextInput?: string;
}
