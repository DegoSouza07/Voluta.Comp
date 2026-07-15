import { IsEnum, IsInt, Min } from 'class-validator';
import { PostFormat } from '../../../common/enums/post-format.enum';

export class CreatePostDto {
  @IsEnum(PostFormat)
  format: PostFormat;

  @IsInt()
  @Min(0)
  orderIndex: number;
}
