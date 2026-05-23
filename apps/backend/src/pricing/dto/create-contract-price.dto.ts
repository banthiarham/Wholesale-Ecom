import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateContractPriceDto {
  @IsString()
  productId: string;

  @IsString()
  userId: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  minQty?: number;

  @IsOptional()
  @IsString()
  validUntil?: string;
}
