import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { CatalogStatus } from '@prisma/client';

export class UpdateCatalogDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsEnum(CatalogStatus)
  status?: CatalogStatus;
}
