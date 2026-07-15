import { IsBoolean, IsObject, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class CreateClientDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug deve conter apenas letras minúsculas, números e hífen' })
  slug: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  instagramHandle?: string;

  @IsOptional()
  @IsString()
  websiteLabel?: string;

  @IsOptional()
  @IsObject()
  brandColors?: Record<string, string>;

  @IsOptional()
  @IsObject()
  brandFonts?: Record<string, string>;

  @IsOptional()
  @IsString()
  toneOfVoice?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
