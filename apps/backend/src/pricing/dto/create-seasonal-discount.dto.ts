import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

export class CreateSeasonalDiscountDto {
  @IsString()
  name: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsNumber()
  minQty?: number;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
