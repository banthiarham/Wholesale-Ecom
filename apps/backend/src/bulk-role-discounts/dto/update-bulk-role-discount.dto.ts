import { IsOptional, IsNumber, IsString, IsBoolean, Min, Max } from 'class-validator';

export class UpdateBulkRoleDiscountDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}