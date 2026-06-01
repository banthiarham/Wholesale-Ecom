import { IsString, IsNumber, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateRolePriceDto {
  @IsString()
  productId: string;

  @IsString()
  roleId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minQty?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}