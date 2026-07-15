import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProjectDto {
  @IsUUID()
  clientId: string;

  @IsString()
  title: string;

  @IsDateString()
  referenceMonth: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}
