import { IsString, IsObject, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  cartId: string;

  @IsObject()
  shippingAddress: any;

  @IsObject()
  @IsOptional()
  billingAddress?: any;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;
}
