import { IsString, IsOptional, IsArray, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Shared conditions used by most rule types that target products/categories/roles.
 */
export class ProductCategoryConditionsDto {
  @ApiPropertyOptional({ description: 'Product IDs this rule applies to' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @ApiPropertyOptional({ description: 'Category IDs this rule applies to' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ description: 'Role names this rule applies to' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}

/** PRODUCT_DISCOUNT conditions */
export class ProductDiscountConditionsDto extends ProductCategoryConditionsDto {
  @ApiPropertyOptional({ description: 'Minimum quantity required for discount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minQty?: number;
}

/** CART_DISCOUNT conditions */
export class CartDiscountConditionsDto {
  @ApiPropertyOptional({ description: 'Minimum subtotal required for cart discount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSubtotal?: number;
}

/** PAYMENT_METHOD_DISCOUNT conditions */
export class PaymentMethodConditionsDto {
  @ApiProperty({ description: 'Payment method name (e.g. CREDIT_CARD, UPI)' })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minQty?: number;
}

/** REQUIRED_QTY_FOR_PAYMENT_METHOD conditions */
export class RequiredQtyPaymentMethodConditionsDto {
  @ApiProperty({ description: 'Payment method name' })
  @IsString()
  paymentMethod: string;

  @ApiProperty({ description: 'Minimum quantity required' })
  @IsNumber()
  @Min(1)
  minQty: number;
}

/** BOGO conditions */
export class BogoConditionsDto {
  @ApiProperty({ description: 'Product ID to buy' })
  @IsString()
  buyProductId: string;

  @ApiProperty({ description: 'Quantity to buy' })
  @IsNumber()
  @Min(1)
  buyQuantity: number;
}

/** BUY_X_AND_Y_FREE conditions — same as BOGO */
export class BuyXAndYFreeConditionsDto extends BogoConditionsDto {}

/** SHIPPING_RULE conditions */
export class ShippingConditionsDto {
  @ApiPropertyOptional({ description: 'Shipping region' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'Minimum order value for shipping rule' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;
}

/** MINIMUM_ORDER_QUANTITY conditions */
export class MinOrderQtyConditionsDto extends ProductCategoryConditionsDto {}

/** MAXIMUM_ORDER_QUANTITY conditions */
export class MaxOrderQtyConditionsDto extends ProductCategoryConditionsDto {}

/** TAX_RULE conditions */
export class TaxConditionsDto extends ProductCategoryConditionsDto {
  @ApiPropertyOptional({ description: 'Region for tax rule' })
  @IsOptional()
  @IsString()
  region?: string;
}

/** CHECKOUT_RESTRICTION conditions */
export class CheckoutRestrictionConditionsDto extends ProductCategoryConditionsDto {}

/** QUANTITY_BASED_DISCOUNT conditions */
export class QuantityDiscountConditionsDto extends ProductCategoryConditionsDto {}

/** EXTRA_CHARGE conditions */
export class ExtraChargeConditionsDto extends ProductCategoryConditionsDto {}

/** RESTRICT_PRODUCT_VISIBILITY conditions */
export class RestrictVisibilityConditionsDto extends ProductCategoryConditionsDto {}

/** HIDDEN_PRICE conditions */
export class HiddenPriceConditionsDto extends ProductCategoryConditionsDto {}

/** NON_PURCHASABLE conditions */
export class NonPurchasableConditionsDto extends ProductCategoryConditionsDto {}

/** LOYALTY_ORDER_EARN conditions */
export class LoyaltyOrderEarnConditionsDto {
  @ApiPropertyOptional({ description: 'Role names this rule applies to' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiPropertyOptional({ description: 'Minimum order amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;
}

/** LOYALTY_CATEGORY_BONUS conditions */
export class LoyaltyCategoryBonusConditionsDto {
  @ApiPropertyOptional({ description: 'Category IDs for bonus' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ description: 'Role names this rule applies to' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}

/** LOYALTY_FIRST_ORDER_BONUS / LOYALTY_REVIEW_BONUS / LOYALTY_REFERRAL_BONUS conditions */
export class LoyaltySimpleConditionsDto {
  @ApiPropertyOptional({ description: 'Role names this rule applies to' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}