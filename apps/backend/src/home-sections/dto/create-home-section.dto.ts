import { IsString, IsOptional, IsInt, IsBoolean, IsJSON } from 'class-validator';

export class CreateHomeSectionDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  config?: any;

  @IsOptional()
  @IsInt()
  rank?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;
}