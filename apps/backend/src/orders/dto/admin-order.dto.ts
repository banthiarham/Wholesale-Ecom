import { IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressDto } from './create-order.dto';

export class AdminOrderItemDto {
  @ApiPropertyOptional({ description: 'Existing order line (edit only). Omit for a newly added line.' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Variant bought, for products that have variants' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Price per unit, excluding GST' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;
}

class AdminOrderBaseDto {
  @ApiProperty({ type: [AdminOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdminOrderItemDto)
  items: AdminOrderItemDto[];

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress: AddressDto;

  @ApiPropertyOptional({ description: 'Shipping charge. Left out = keep the current / rule-based amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingAmount?: number;

  @ApiPropertyOptional({ description: 'Discount. Left out = keep the current amount (0 for a new order)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Grand total typed in by the admin; the difference to the calculated total is stored as round off' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminCreateOrderDto extends AdminOrderBaseDto {
  @ApiProperty({ description: 'Customer the order is made for' })
  @IsUUID()
  userId: string;
}

export class AdminUpdateOrderDto extends AdminOrderBaseDto {}
