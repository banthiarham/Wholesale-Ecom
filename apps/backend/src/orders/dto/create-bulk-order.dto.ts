import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkOrderItemDto {
  @ApiProperty({ example: 'product-uuid' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateBulkOrderDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  userId: string;

  @ApiProperty({ type: [BulkOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkOrderItemDto)
  items: BulkOrderItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  shippingAddress?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}