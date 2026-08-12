import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CartItemContext {
  productId: string;
  categoryId?: string;
  quantity: number;
  unitPrice: number;
}

export interface RuleContext {
  userId?: string;
  userRole?: string;
  cartItems?: CartItemContext[];
  subtotal?: number;
  paymentMethod?: string;
  shippingRegion?: string;
  /** The business's own GST-registered state (Admin → Tax Management → Business State). */
  sellerState?: string;
}

export interface RuleEvaluationResult {
  productDiscounts: { productId: string; discountAmount: number; discountPercent: number; ruleName: string }[];
  cartDiscount: { discountAmount: number; discountPercent: number; ruleName: string } | null;
  paymentMethodDiscount: { discountAmount: number; ruleName: string } | null;
  availablePaymentMethods: { method: string; minQty: number | null }[];
  bogo: { buyProductId: string; buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[];
  shipping: { shippingType: string; cost: number; ruleName: string } | null;
  minimumOrderQuantities: { productId?: string; minQty: number; ruleName: string }[];
  taxes: {
    taxRate: number;
    taxLabel: string;
    ruleName: string;
    /** Actual GST type applied to this evaluation — auto-determined by state comparison, not the rule's stored (preview-only) taxType. */
    taxType: 'CGST_SGST' | 'IGST';
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
  }[];
  checkoutRestrictions: { restricted: boolean; message: string; ruleName: string }[];
  quantityDiscounts: { productId?: string; tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }[];
  extraCharges: { chargeAmount: number; chargeLabel: string; ruleName: string }[];
  maximumOrderQuantities: { productId?: string; maxQty: number; ruleName: string }[];
  hiddenProducts: string[];
  hiddenPrices: string[];
  nonPurchasable: { productId: string; message?: string }[];
  customBadges: { productId: string; badgeLabel: string; badgeColor: string | null; ruleName: string }[];
}

@Injectable()
export class RulesEngineService {
  constructor(private prisma: PrismaService) {}

  async evaluateRules(context: RuleContext): Promise<RuleEvaluationResult> {
    const now = new Date();
    const rules = await this.prisma.dynamicRule.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
        ],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    const result: RuleEvaluationResult = {
      productDiscounts: [],
      cartDiscount: null,
      paymentMethodDiscount: null,
      availablePaymentMethods: [],
      bogo: [],
      shipping: null,
      minimumOrderQuantities: [],
      taxes: [],
      checkoutRestrictions: [],
      quantityDiscounts: [],
      extraCharges: [],
      maximumOrderQuantities: [],
      hiddenProducts: [],
      hiddenPrices: [],
      nonPurchasable: [],
      customBadges: [],
    };

    for (const rule of rules) {
      const c = rule.conditions as Record<string, any>;
      const a = rule.actions as Record<string, any>;

      const effectiveBadgeLabel = rule.badgeLabel || this.defaultBadgeLabelFor(rule.type, c, a);
      if (effectiveBadgeLabel) {
        const matched = this.matchesProductsForBadge(rule.type, c, context);
        for (const item of matched) {
          result.customBadges.push({
            productId: item.productId,
            badgeLabel: effectiveBadgeLabel,
            badgeColor: rule.badgeColor,
            ruleName: rule.name,
          });
        }
      }

      switch (rule.type) {
        case 'PRODUCT_DISCOUNT':
          this.evaluateProductDiscount(rule.id, rule.name, c, a, context, result);
          break;
        case 'CART_DISCOUNT':
          this.evaluateCartDiscount(rule.id, rule.name, c, a, context, result);
          break;
        case 'PAYMENT_METHOD_DISCOUNT':
          this.evaluatePaymentMethodDiscount(rule.id, rule.name, c, a, context, result);
          break;
        case 'REQUIRED_QTY_FOR_PAYMENT_METHOD':
          this.evaluateRequiredQtyForPaymentMethod(rule.id, rule.name, c, a, context, result);
          break;
        case 'BOGO':
          this.evaluateBogo(rule.id, rule.name, c, a, context, result);
          break;
        case 'SHIPPING_RULE':
          this.evaluateShippingRule(rule.id, rule.name, c, a, context, result);
          break;
        case 'MINIMUM_ORDER_QUANTITY':
          this.evaluateMinOrderQty(rule.id, rule.name, c, a, context, result);
          break;
        case 'TAX_RULE':
          this.evaluateTaxRule(rule.id, rule.name, c, a, context, result);
          break;
        case 'CHECKOUT_RESTRICTION':
          this.evaluateCheckoutRestriction(rule.id, rule.name, c, a, context, result);
          break;
        case 'QUANTITY_BASED_DISCOUNT':
          this.evaluateQuantityBasedDiscount(rule.id, rule.name, c, a, context, result);
          break;
        case 'EXTRA_CHARGE':
          this.evaluateExtraCharge(rule.id, rule.name, c, a, context, result);
          break;
        case 'BUY_X_AND_Y_FREE':
          this.evaluateBuyXAndYFree(rule.id, rule.name, c, a, context, result);
          break;
        case 'MAXIMUM_ORDER_QUANTITY':
          this.evaluateMaxOrderQty(rule.id, rule.name, c, a, context, result);
          break;
        case 'RESTRICT_PRODUCT_VISIBILITY':
          this.evaluateRestrictVisibility(rule.id, rule.name, c, a, context, result);
          break;
        case 'HIDDEN_PRICE':
          this.evaluateHiddenPrice(rule.id, rule.name, c, a, context, result);
          break;
        case 'NON_PURCHASABLE':
          this.evaluateNonPurchasable(rule.id, rule.name, c, a, context, result);
          break;
      }
    }

    return result;
  }

  // Rule types whose conditions carry productIds/categoryIds (via ProductCategoryConditionsDto)
  // and where an empty selection deliberately means "applies to every product" — matches
  // matchesProducts()'s existing fallback.
  private static readonly PRODUCT_CATEGORY_SCOPED_TYPES = new Set([
    'PRODUCT_DISCOUNT',
    'MINIMUM_ORDER_QUANTITY',
    'MAXIMUM_ORDER_QUANTITY',
    'TAX_RULE',
    'CHECKOUT_RESTRICTION',
    'QUANTITY_BASED_DISCOUNT',
    'EXTRA_CHARGE',
    'RESTRICT_PRODUCT_VISIBILITY',
    'HIDDEN_PRICE',
    'NON_PURCHASABLE',
  ]);

  // Resolves which cart items a rule's admin-configured badge should attach to. Badges are only
  // meaningful on a specific product's image, so this only matches types that actually name a
  // product: PRODUCT_DISCOUNT-family rules scope via conditions.productIds/categoryIds (falling
  // through to matchesProducts, where an empty selection means "every product" by design), and
  // BOGO/BUY_X_AND_Y_FREE scope via conditions.buyProductId (a field matchesProducts never reads,
  // so without this it fell through to "no productIds/categoryIds" and wrongly matched every
  // product in the request). Cart/payment/shipping/loyalty rule types have no product to anchor a
  // badge to, so they never emit one — showing no badge is correct there, not a hidden rule.
  private matchesProductsForBadge(
    type: string, c: Record<string, any>, context: RuleContext,
  ): CartItemContext[] {
    if (type === 'BOGO' || type === 'BUY_X_AND_Y_FREE') {
      if (!context.cartItems || !c.buyProductId) return [];
      return context.cartItems.filter((item) => item.productId === c.buyProductId);
    }
    if (RulesEngineService.PRODUCT_CATEGORY_SCOPED_TYPES.has(type)) {
      return this.matchesProducts(c, context);
    }
    return [];
  }

  // Promotional rule types shouldn't need the admin to separately remember to
  // fill in the optional "Product Badge" text field just to be visible at all —
  // the whole point of applying one of these rules is to advertise it on the
  // product. Every label here is derived purely from the rule's own
  // conditions/actions (never hardcoded), and an admin-typed badgeLabel, if
  // set, always takes precedence (see the caller in evaluateRules).
  private defaultBadgeLabelFor(type: string, c: Record<string, any>, a: Record<string, any>): string | null {
    if ((type === 'BOGO' || type === 'BUY_X_AND_Y_FREE') && c.buyQuantity) {
      return `Buy ${c.buyQuantity} Get ${a.freeQuantity || 1} Free`;
    }
    if (type === 'PRODUCT_DISCOUNT' && a.discountValue) {
      return a.discountType === 'FLAT' ? `₹${a.discountValue} OFF` : `${a.discountValue}% OFF`;
    }
    if (type === 'QUANTITY_BASED_DISCOUNT' && Array.isArray(a.tiers) && a.tiers.length > 0) {
      const best = a.tiers.reduce((max: any, t: any) => (t.discountValue > (max?.discountValue ?? -Infinity) ? t : max), null);
      if (best) return best.discountType === 'FLAT' ? `Bulk: ₹${best.discountValue} OFF` : `Bulk: ${best.discountValue}% OFF`;
    }
    return null;
  }

  private matchesProducts(c: Record<string, any>, context: RuleContext): CartItemContext[] {
    if (!context.cartItems || context.cartItems.length === 0) return [];
    const productIds: string[] = c.productIds || [];
    const categoryIds: string[] = c.categoryIds || [];
    if (productIds.length === 0 && categoryIds.length === 0) return context.cartItems;
    return context.cartItems.filter((item) => {
      if (productIds.length > 0 && productIds.includes(item.productId)) return true;
      if (categoryIds.length > 0 && item.categoryId && categoryIds.includes(item.categoryId)) return true;
      return false;
    });
  }

  private matchesRole(c: Record<string, any>, context: RuleContext): boolean {
    const roleNames: string[] = c.roleIds || [];
    if (roleNames.length === 0) return true;
    return !!context.userRole && roleNames.includes(context.userRole);
  }

  private evaluateProductDiscount(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    const items = this.matchesProducts(c, context);
    const minQty = c.minQty || 0;
    for (const item of items) {
      if (minQty > 0 && item.quantity < minQty) continue;
      let discountAmount = 0;
      let discountPercent = 0;
      if (a.discountType === 'PERCENTAGE') {
        discountPercent = a.discountValue;
        discountAmount = (item.unitPrice * a.discountValue) / 100;
      } else {
        discountAmount = a.discountValue;
        discountPercent = item.unitPrice > 0 ? (a.discountValue / item.unitPrice) * 100 : 0;
      }
      result.productDiscounts.push({ productId: item.productId, discountAmount, discountPercent, ruleName: name });
    }
  }

  private evaluateCartDiscount(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    const minSubtotal = c.minSubtotal || 0;
    if (context.subtotal && context.subtotal >= minSubtotal) {
      let discountAmount = 0;
      let discountPercent = 0;
      if (a.discountType === 'PERCENTAGE') {
        discountPercent = a.discountValue;
        discountAmount = (context.subtotal * a.discountValue) / 100;
      } else {
        discountAmount = a.discountValue;
        discountPercent = context.subtotal > 0 ? (a.discountValue / context.subtotal) * 100 : 0;
      }
      result.cartDiscount = { discountAmount, discountPercent, ruleName: name };
    }
  }

  private evaluatePaymentMethodDiscount(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    if (context.paymentMethod === c.paymentMethod) {
      let discountAmount = 0;
      if (a.discountType === 'PERCENTAGE' && context.subtotal) {
        discountAmount = (context.subtotal * a.discountValue) / 100;
      } else {
        discountAmount = a.discountValue;
      }
      result.paymentMethodDiscount = { discountAmount, ruleName: name };
    }
  }

  private evaluateRequiredQtyForPaymentMethod(
    _id: string, name: string, c: Record<string, any>, _a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    const totalQty = context.cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    result.availablePaymentMethods.push({
      method: c.paymentMethod,
      minQty: totalQty >= c.minQty ? null : c.minQty,
    });
  }

  private evaluateBogo(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    if (!context.cartItems) return;
    const matching = context.cartItems.find((item) => item.productId === c.buyProductId && item.quantity >= c.buyQuantity);
    if (matching) {
      result.bogo.push({
        buyProductId: c.buyProductId,
        buyQuantity: c.buyQuantity,
        freeProductId: a.freeProductId,
        freeQuantity: a.freeQuantity || 1,
        ruleName: name,
      });
    }
  }

  private evaluateShippingRule(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    if (!result.shipping) {
      const minOrderValue = c.minOrderValue || 0;
      const regionMatch = !c.region || c.region === context.shippingRegion;
      const subtotalMet = (context.subtotal || 0) >= minOrderValue;
      if (regionMatch && subtotalMet) {
        let cost = 0;
        if (a.shippingType === 'FLAT_RATE') cost = a.flatRate || 0;
        result.shipping = { shippingType: a.shippingType, cost, ruleName: name };
      }
    }
  }

  private evaluateMinOrderQty(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    const items = this.matchesProducts(c, context);
    if (items.length === 0 && (c.productIds?.length > 0 || c.categoryIds?.length > 0)) {
      // rule applies to specific products not in cart
      return;
    }
    const minQty = a.minQty || 1;
    for (const item of items) {
      if (item.quantity < minQty) {
        result.minimumOrderQuantities.push({ productId: item.productId, minQty, ruleName: name });
      }
    }
  }

  private evaluateTaxRule(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    const regionMatch = !c.region || c.region === context.shippingRegion;
    const items = this.matchesProducts(c, context);
    if (!regionMatch) return;
    if (items.length === 0 && (c.productIds?.length > 0 || c.categoryIds?.length > 0)) return;

    // Indian GST: same state as the business → CGST+SGST (rate split evenly); different
    // state → IGST (full rate). This is always derived from the actual seller/buyer states
    // for this order, never from the rule's stored (preview-only) actions.taxType — GST law
    // ties the split to each transaction's place of supply, not to a fixed rule setting. If
    // either state is unknown (e.g. Business State not yet configured, or no shipping address
    // yet), default to CGST+SGST — the total tax charged is identical either way (taxRate is
    // never applied twice), only the label/breakdown differs.
    const taxRate = a.taxRate;
    const isInterState = !!context.sellerState && !!context.shippingRegion && context.sellerState !== context.shippingRegion;
    const taxType: 'CGST_SGST' | 'IGST' = isInterState ? 'IGST' : 'CGST_SGST';

    result.taxes.push({
      taxRate,
      taxLabel: a.taxLabel || 'GST',
      ruleName: name,
      taxType,
      cgstRate: taxType === 'CGST_SGST' ? taxRate / 2 : 0,
      sgstRate: taxType === 'CGST_SGST' ? taxRate / 2 : 0,
      igstRate: taxType === 'IGST' ? taxRate : 0,
    });
  }

  private evaluateCheckoutRestriction(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    if (!this.matchesRole(c, context)) return;
    const items = this.matchesProducts(c, context);
    if (items.length === 0 && (c.productIds?.length > 0 || c.categoryIds?.length > 0)) return;
    result.checkoutRestrictions.push({
      restricted: true,
      message: a.message || `Checkout restricted by rule: ${name}`,
      ruleName: name,
    });
  }

  private evaluateQuantityBasedDiscount(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    const items = this.matchesProducts(c, context);
    if (items.length === 0 && (c.productIds?.length > 0 || c.categoryIds?.length > 0)) return;
    const tiers = a.tiers || [];
    if (tiers.length === 0) return;
    for (const item of items) {
      result.quantityDiscounts.push({ productId: item.productId, tiers, ruleName: name });
    }
  }

  private evaluateExtraCharge(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    const items = this.matchesProducts(c, context);
    if (items.length === 0 && (c.productIds?.length > 0 || c.categoryIds?.length > 0)) return;
    let chargeAmount = 0;
    if (a.chargeType === 'PERCENTAGE') {
      chargeAmount = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity * a.chargeValue) / 100, 0);
    } else {
      chargeAmount = a.chargeValue;
    }
    result.extraCharges.push({ chargeAmount, chargeLabel: a.chargeLabel || 'Extra Charge', ruleName: name });
  }

  private evaluateBuyXAndYFree(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    if (!context.cartItems) return;
    const matching = context.cartItems.find((item) => item.productId === c.buyProductId && item.quantity >= c.buyQuantity);
    if (matching) {
      result.bogo.push({
        buyProductId: c.buyProductId,
        buyQuantity: c.buyQuantity,
        freeProductId: a.freeProductId,
        freeQuantity: a.freeQuantity || 1,
        ruleName: name,
      });
    }
  }

  private evaluateMaxOrderQty(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    const items = this.matchesProducts(c, context);
    const maxQty = a.maxQty || 999;
    if (items.length === 0 && (c.productIds?.length > 0 || c.categoryIds?.length > 0)) return;
    for (const item of items) {
      if (item.quantity > maxQty) {
        result.maximumOrderQuantities.push({ productId: item.productId, maxQty, ruleName: name });
      }
    }
  }

  private evaluateRestrictVisibility(
    _id: string, name: string, c: Record<string, any>, _a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    if (!this.matchesRole(c, context)) return;
    // Resolve productIds directly from conditions
    const directProductIds: string[] = c.productIds || [];
    // Also resolve products that match via categoryIds from the cart context
    const matchingItems = this.matchesProducts(c, context);
    const categoryProductIds = matchingItems.map((item) => item.productId);
    const allProductIds = [...new Set([...directProductIds, ...categoryProductIds])];
    result.hiddenProducts.push(...allProductIds);
  }

  private evaluateHiddenPrice(
    _id: string, name: string, c: Record<string, any>, _a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    if (!this.matchesRole(c, context)) return;
    // Resolve productIds directly from conditions
    const directProductIds: string[] = c.productIds || [];
    // Also resolve products that match via categoryIds from the cart context
    const matchingItems = this.matchesProducts(c, context);
    const categoryProductIds = matchingItems.map((item) => item.productId);
    const allProductIds = [...new Set([...directProductIds, ...categoryProductIds])];
    result.hiddenPrices.push(...allProductIds);
  }

  private evaluateNonPurchasable(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    if (!this.matchesRole(c, context)) return;
    // Resolve productIds directly from conditions
    const directProductIds: string[] = c.productIds || [];
    // Also resolve products that match via categoryIds from the cart context
    const matchingItems = this.matchesProducts(c, context);
    const categoryProductIds = matchingItems.map((item) => item.productId);
    const allProductIds = [...new Set([...directProductIds, ...categoryProductIds])];
    for (const pid of allProductIds) {
      result.nonPurchasable.push({ productId: pid, message: a.message });
    }
  }
}