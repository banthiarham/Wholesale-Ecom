import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { RulesEngineService, RuleContext, RuleEvaluationResult } from './rules-engine.service';

@Injectable()
export class RulesEnforcementService {
  private readonly logger = new Logger(RulesEnforcementService.name);

  constructor(private rulesEngine: RulesEngineService) {}

  /**
   * Evaluate rules and throw on cart-level violations:
   * - NON_PURCHASABLE: product cannot be added to cart
   * - MAXIMUM_ORDER_QUANTITY: quantity exceeds the allowed maximum
   *
   * Returns the evaluation result for downstream use (e.g., pricing adjustments).
   */
  async enforceCartRules(context: RuleContext): Promise<RuleEvaluationResult> {
    const result = await this.rulesEngine.evaluateRules(context);

    if (result.nonPurchasable.length > 0) {
      const messages = result.nonPurchasable.map(
        (np) => np.message || `Product ${np.productId} is not available for purchase`,
      );
      throw new BadRequestException(messages.join('; '));
    }

    if (result.maximumOrderQuantities.length > 0) {
      const messages = result.maximumOrderQuantities.map(
        (mq) =>
          `Product ${mq.productId} exceeds maximum quantity of ${mq.maxQty} (rule: ${mq.ruleName})`,
      );
      throw new BadRequestException(messages.join('; '));
    }

    return result;
  }

  /**
   * Evaluate rules and throw on order-level violations:
   * - CHECKOUT_RESTRICTION: user/role is blocked from checkout
   * - NON_PURCHASABLE: product cannot be ordered
   * - MINIMUM_ORDER_QUANTITY: quantity below required minimum
   * - MAXIMUM_ORDER_QUANTITY: quantity exceeds allowed maximum
   *
   * Returns the evaluation result for downstream use.
   */
  async enforceOrderRules(context: RuleContext): Promise<RuleEvaluationResult> {
    const result = await this.rulesEngine.evaluateRules(context);

    if (result.checkoutRestrictions.length > 0) {
      const messages = result.checkoutRestrictions.map(
        (cr) => cr.message || `Checkout restricted by rule: ${cr.ruleName}`,
      );
      throw new ForbiddenException(messages.join('; '));
    }

    if (result.nonPurchasable.length > 0) {
      const messages = result.nonPurchasable.map(
        (np) => np.message || `Product ${np.productId} is not available for purchase`,
      );
      throw new BadRequestException(messages.join('; '));
    }

    if (result.minimumOrderQuantities.length > 0) {
      const messages = result.minimumOrderQuantities.map(
        (mq) =>
          `Product ${mq.productId} requires minimum quantity of ${mq.minQty} (rule: ${mq.ruleName})`,
      );
      throw new BadRequestException(messages.join('; '));
    }

    if (result.maximumOrderQuantities.length > 0) {
      const messages = result.maximumOrderQuantities.map(
        (mq) =>
          `Product ${mq.productId} exceeds maximum quantity of ${mq.maxQty} (rule: ${mq.ruleName})`,
      );
      throw new BadRequestException(messages.join('; '));
    }

    return result;
  }

  /**
   * Check if any products in the cart are non-purchasable or hidden.
   * Returns the list of non-purchasable product IDs for filtering.
   * Does NOT throw — used for pre-checks where you want to filter rather than block.
   */
  async checkProductAccess(context: RuleContext): Promise<{
    nonPurchasableIds: string[];
    hiddenProductIds: string[];
  }> {
    const result = await this.rulesEngine.evaluateRules(context);

    return {
      nonPurchasableIds: result.nonPurchasable.map((np) => np.productId),
      hiddenProductIds: result.hiddenProducts,
    };
  }
}