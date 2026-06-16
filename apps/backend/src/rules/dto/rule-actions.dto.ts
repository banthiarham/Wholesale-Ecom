import { IsString, IsOptional, IsNumber, IsArray, IsEnum, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Discount type enum shared across multiple action DTOs */
const DISCOUNT_TYPES = ['PERCENTAGE', 'FLAT'] as const;

/** PRODUCT_DISCOUNT / CART_DISCOUNT / PAYMENT_METHOD_DISCOUNT actions */
export class DiscountActionDto {
  @ApiProperty({ enum: DISCOUNT_TYPES, description: 'Discount type' })
  @IsEnum(DISCOUNT_TYPES)
  discountType: 'PERCENTAGE' | 'FLAT';

  @ApiProperty({ description: 'Discount value (percentage or flat amount)' })
  @IsNumber()
  @Min(0)
  discountValue: number;
}

/** BOGO / BUY_X_AND_Y_FREE actions */
export class BogoActionDto {
  @ApiProperty({ description: 'Product ID given for free' })
  @IsString()
  freeProductId: string;

  @ApiPropertyOptional({ description: 'Quantity given for free' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  freeQuantity?: number;
}

/** MINIMUM_ORDER_QUANTITY actions */
export class MinQtyActionDto {
  @ApiProperty({ description: 'Minimum order quantity' })
  @IsNumber()
  @Min(1)
  minQty: number;
}

/** MAXIMUM_ORDER_QUANTITY actions */
export class MaxQtyActionDto {
  @ApiProperty({ description: 'Maximum order quantity' })
  @IsNumber()
  @Min(1)
  maxQty: number;
}

/** CHECKOUT_RESTRICTION / NON_PURCHASABLE actions */
export class MessageActionDto {
  @ApiPropertyOptional({ description: 'Message shown to user' })
  @IsOptional()
  @IsString()
  message?: string;
}

/** SHIPPING_RULE actions */
export class ShippingActionDto {
  @ApiProperty({ enum: ['FREE', 'FLAT_RATE', 'CONDITIONAL'], description: 'Shipping type' })
  @IsEnum(['FREE', 'FLAT_RATE', 'CONDITIONAL'])
  shippingType: 'FREE' | 'FLAT_RATE' | 'CONDITIONAL';

  @ApiPropertyOptional({ description: 'Flat rate shipping cost' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatRate?: number;
}

/** TAX_RULE actions */
export class TaxActionDto {
  @ApiProperty({ description: 'Tax rate percentage' })
  @IsNumber()
  @Min(0)
  taxRate: number;

  @ApiPropertyOptional({ description: 'Tax label shown to user' })
  @IsOptional()
  @IsString()
  taxLabel?: string;
}

/** EXTRA_CHARGE actions */
export class ExtraChargeActionDto {
  @ApiProperty({ enum: DISCOUNT_TYPES, description: 'Charge type' })
  @IsEnum(DISCOUNT_TYPES)
  chargeType: 'PERCENTAGE' | 'FLAT';

  @ApiProperty({ description: 'Charge value' })
  @IsNumber()
  @Min(0)
  chargeValue: number;

  @ApiPropertyOptional({ description: 'Label shown to user' })
  @IsOptional()
  @IsString()
  chargeLabel?: string;
}

/** Quantity tier for QUANTITY_BASED_DISCOUNT */
export class QuantityTierDto {
  @ApiProperty({ description: 'Minimum quantity for tier' })
  @IsNumber()
  @Min(1)
  minQty: number;

  @ApiProperty({ enum: DISCOUNT_TYPES, description: 'Discount type for tier' })
  @IsEnum(DISCOUNT_TYPES)
  discountType: 'PERCENTAGE' | 'FLAT';

  @ApiProperty({ description: 'Discount value for tier' })
  @IsNumber()
  @Min(0)
  discountValue: number;
}

/** QUANTITY_BASED_DISCOUNT actions */
export class QuantityDiscountActionDto {
  @ApiProperty({ description: 'Quantity discount tiers', type: [QuantityTierDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuantityTierDto)
  tiers: QuantityTierDto[];
}

/** REQUIRED_QTY_FOR_PAYMENT_METHOD actions (empty — conditions carry the data) */
export class RequiredQtyPaymentMethodActionDto {}

/** RESTRICT_PRODUCT_VISIBILITY / HIDDEN_PRICE actions (empty — condition-driven) */
export class RestrictVisibilityActionDto {}
export class HiddenPriceActionDto {}

/** LOYALTY_ORDER_EARN actions */
export class LoyaltyOrderEarnActionDto {
  @ApiPropertyOptional({ description: 'Points earned per currency unit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerUnit?: number;
}

/** LOYALTY_CATEGORY_BONUS actions */
export class LoyaltyCategoryBonusActionDto {
  @ApiPropertyOptional({ description: 'Bonus points for category purchase' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusPoints?: number;
}

/** LOYALTY_FIRST_ORDER_BONUS / LOYALTY_REVIEW_BONUS / LOYALTY_REFERRAL_BONUS actions */
export class LoyaltyBonusActionDto {
  @ApiPropertyOptional({ description: 'Bonus points awarded' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusPoints?: number;
}