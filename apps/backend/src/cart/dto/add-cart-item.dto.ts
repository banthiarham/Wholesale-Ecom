import { IsString, IsNumber, IsOptional } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  /** Offer the shopper picked for this product: a rule id, or "none". */
  @IsOptional()
  @IsString()
  offerChoice?: string;

  /** Required for products with variants: the chosen variant. */
  @IsOptional()
  @IsString()
  variantId?: string;
}
