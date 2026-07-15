import { IsEnum, IsIn, IsInt, IsString, Min } from 'class-validator';
import { PostMediaKind } from '../entities/post-media.entity';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

export class CreateUploadUrlDto {
  @IsString()
  filename: string;

  @IsIn(ALLOWED_CONTENT_TYPES, {
    message: `contentType deve ser um de: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
  })
  contentType: string;

  @IsEnum(PostMediaKind)
  kind: PostMediaKind;

  // 0 pra cover/reel (só existe 1 de cada); 0..N-1 pra slides de carrossel
  @IsInt()
  @Min(0)
  orderIndex: number;
}
