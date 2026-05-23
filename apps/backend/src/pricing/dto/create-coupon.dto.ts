import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { DiscountType } from './create-seasonal-discount.dto';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsNumber()
  minOrderValue?: number;

  @IsOptional()
  @IsNumber()
  maxUses?: number;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}
