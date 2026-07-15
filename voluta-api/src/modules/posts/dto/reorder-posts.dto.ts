import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

class PostOrderItem {
  @IsUUID()
  id: string;

  @IsInt()
  @Min(0)
  orderIndex: number;
}

// Corpo do PATCH /projects/:id/posts/reorder — sempre o array completo,
// nunca uma reordenação parcial (ver Etapa 4: debounce no front, 1 request
// por drag-session, não por drag-event).
export class ReorderPostsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PostOrderItem)
  items: PostOrderItem[];
}
