import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CatalogItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  sortOrder?: number;

  @IsOptional()
  customPrice?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCatalogDto {
  @IsString()
  name: string;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogItemDto)
  items?: CatalogItemDto[];
}
