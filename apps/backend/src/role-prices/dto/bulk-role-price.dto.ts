import { IsString, IsArray, IsNumber, IsOptional, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RolePriceEntryDto {
  @IsString()
  roleId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minQty?: number;
}

export class BulkRolePriceDto {
  @IsString()
  productId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePriceEntryDto)
  prices: RolePriceEntryDto[];
}