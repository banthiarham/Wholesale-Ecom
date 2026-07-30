import { BadRequestException } from '@nestjs/common';
import { validateOrReject, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DynamicRuleType } from '@prisma/client';

import {
  ProductCategoryConditionsDto,
  ProductDiscountConditionsDto,
  CartDiscountConditionsDto,
  PaymentMethodConditionsDto,
  RequiredQtyPaymentMethodConditionsDto,
  BogoConditionsDto,
  BuyXAndYFreeConditionsDto,
  ShippingConditionsDto,
  MinOrderQtyConditionsDto,
  MaxOrderQtyConditionsDto,
  TaxConditionsDto,
  CheckoutRestrictionConditionsDto,
  QuantityDiscountConditionsDto,
  ExtraChargeConditionsDto,
  RestrictVisibilityConditionsDto,
  HiddenPriceConditionsDto,
  NonPurchasableConditionsDto,
  LoyaltyOrderEarnConditionsDto,
  LoyaltyCategoryBonusConditionsDto,
  LoyaltySimpleConditionsDto,
} from './rule-conditions.dto';

import {
  DiscountActionDto,
  BogoActionDto,
  MinQtyActionDto,
  MaxQtyActionDto,
  MessageActionDto,
  ShippingActionDto,
  TaxActionDto,
  ExtraChargeActionDto,
  QuantityDiscountActionDto,
  RequiredQtyPaymentMethodActionDto,
  RestrictVisibilityActionDto,
  HiddenPriceActionDto,
  LoyaltyOrderEarnActionDto,
  LoyaltyCategoryBonusActionDto,
  LoyaltyBonusActionDto,
} from './rule-actions.dto';

/**
 * Maps each DynamicRuleType to the DTO class that validates its conditions.
 * null means no conditions validation is needed (rare).
 */
const CONDITIONS_MAP: Record<DynamicRuleType, any> = {
  PRODUCT_DISCOUNT: ProductDiscountConditionsDto,
  CART_DISCOUNT: CartDiscountConditionsDto,
  PAYMENT_METHOD_DISCOUNT: PaymentMethodConditionsDto,
  REQUIRED_QTY_FOR_PAYMENT_METHOD: RequiredQtyPaymentMethodConditionsDto,
  BOGO: BogoConditionsDto,
  SHIPPING_RULE: ShippingConditionsDto,
  MINIMUM_ORDER_QUANTITY: MinOrderQtyConditionsDto,
  TAX_RULE: TaxConditionsDto,
  CHECKOUT_RESTRICTION: CheckoutRestrictionConditionsDto,
  QUANTITY_BASED_DISCOUNT: QuantityDiscountConditionsDto,
  EXTRA_CHARGE: ExtraChargeConditionsDto,
  BUY_X_AND_Y_FREE: BuyXAndYFreeConditionsDto,
  MAXIMUM_ORDER_QUANTITY: MaxOrderQtyConditionsDto,
  RESTRICT_PRODUCT_VISIBILITY: RestrictVisibilityConditionsDto,
  HIDDEN_PRICE: HiddenPriceConditionsDto,
  NON_PURCHASABLE: NonPurchasableConditionsDto,
  LOYALTY_ORDER_EARN: LoyaltyOrderEarnConditionsDto,
  LOYALTY_CATEGORY_BONUS: LoyaltyCategoryBonusConditionsDto,
  LOYALTY_FIRST_ORDER_BONUS: LoyaltySimpleConditionsDto,
  LOYALTY_REVIEW_BONUS: LoyaltySimpleConditionsDto,
  LOYALTY_REFERRAL_BONUS: LoyaltySimpleConditionsDto,
};

/**
 * Maps each DynamicRuleType to the DTO class that validates its actions.
 * null means no actions validation is needed.
 */
const ACTIONS_MAP: Record<DynamicRuleType, any> = {
  PRODUCT_DISCOUNT: DiscountActionDto,
  CART_DISCOUNT: DiscountActionDto,
  PAYMENT_METHOD_DISCOUNT: DiscountActionDto,
  REQUIRED_QTY_FOR_PAYMENT_METHOD: RequiredQtyPaymentMethodActionDto,
  BOGO: BogoActionDto,
  SHIPPING_RULE: ShippingActionDto,
  MINIMUM_ORDER_QUANTITY: MinQtyActionDto,
  TAX_RULE: TaxActionDto,
  CHECKOUT_RESTRICTION: MessageActionDto,
  QUANTITY_BASED_DISCOUNT: QuantityDiscountActionDto,
  EXTRA_CHARGE: ExtraChargeActionDto,
  BUY_X_AND_Y_FREE: BogoActionDto,
  MAXIMUM_ORDER_QUANTITY: MaxQtyActionDto,
  RESTRICT_PRODUCT_VISIBILITY: RestrictVisibilityActionDto,
  HIDDEN_PRICE: HiddenPriceActionDto,
  NON_PURCHASABLE: MessageActionDto,
  LOYALTY_ORDER_EARN: LoyaltyOrderEarnActionDto,
  LOYALTY_CATEGORY_BONUS: LoyaltyCategoryBonusActionDto,
  LOYALTY_FIRST_ORDER_BONUS: LoyaltyBonusActionDto,
  LOYALTY_REVIEW_BONUS: LoyaltyBonusActionDto,
  LOYALTY_REFERRAL_BONUS: LoyaltyBonusActionDto,
};

/**
 * Flattens class-validator's ValidationError tree (including nested errors from
 * @ValidateNested, e.g. QUANTITY_BASED_DISCOUNT's tiers array) into readable messages.
 */
function formatValidationErrors(errors: ValidationError[]): string {
  const messages: string[] = [];
  for (const err of errors) {
    if (err.constraints) {
      messages.push(...Object.values(err.constraints));
    }
    if (err.children && err.children.length > 0) {
      messages.push(formatValidationErrors(err.children));
    }
  }
  return messages.join('; ');
}

/**
 * Validates rule conditions and actions against their type-specific DTOs.
 * Throws a BadRequestException (400) — not a raw ValidationError[] — if the
 * conditions/actions don't match the expected shape for the given rule type.
 * validateOrReject rejects with a plain ValidationError[] rather than an
 * HttpException, which NestJS's exception filter can't interpret and falls
 * back to a 500; this converts it into a proper, readable 400 response.
 */
export async function validateRuleConditionsActions(
  type: DynamicRuleType,
  conditions: any,
  actions: any,
): Promise<void> {
  const CondClass = CONDITIONS_MAP[type];
  const ActClass = ACTIONS_MAP[type];

  if (CondClass && conditions) {
    const instance = plainToInstance(CondClass, conditions);
    try {
      await validateOrReject(instance, {
        whitelist: true,
        forbidNonWhitelisted: false, // allow extra fields for forward-compat
      });
    } catch (errors) {
      throw new BadRequestException(
        `Invalid conditions for rule type "${type}": ${formatValidationErrors(errors as ValidationError[])}`,
      );
    }
  }

  if (ActClass && actions) {
    const instance = plainToInstance(ActClass, actions);
    try {
      await validateOrReject(instance, {
        whitelist: true,
        forbidNonWhitelisted: false,
      });
    } catch (errors) {
      throw new BadRequestException(
        `Invalid actions for rule type "${type}": ${formatValidationErrors(errors as ValidationError[])}`,
      );
    }
  }
}