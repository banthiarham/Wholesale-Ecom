import { IsOptional, IsNumber, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateRolePriceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minQty?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}