import { IsArray, IsString, IsInt, Min, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class QuickOrderItemDto {
  @IsString()
  sku: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class QuickOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuickOrderItemDto)
  items: QuickOrderItemDto[];

  @IsOptional()
  shippingAddress: any;

  @IsOptional()
  @IsString()
  notes?: string;
}