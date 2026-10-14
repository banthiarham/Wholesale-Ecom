import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CartItemContext {
  productId: string;
  categoryId?: string;
  quantity: number;
  unitPrice: number;
  /**
   * The shopper's pick among this product's offers: a rule id, or 'none' to opt out of every
   * offer. Unset = apply the best offer whose condition is met. Only one offer per product
   * is ever applied.
   */
  offerChoice?: string;
  /** Variant of this cart line (products with variants have one line per variant). */
  variantId?: string;
}

export interface ProductOffer {
  ruleId: string;
  name: string;
  type: string;
  /** Admin-written description, falling back to a generated summary of the rule. */
  description: string;
  /** Short human text of what the offer gives, e.g. "Rs 200 off per unit". */
  summary: string;
  /** What must be true for it to apply, e.g. "Buy 9+ units"; null when it has no condition. */
  condition: string | null;
  /** Units still needed for the condition to be met (0 when met / no condition). */
  unitsNeeded: number;
  eligible: boolean;
  /** Estimated saving at the current quantity (used to pick the best offer automatically). */
  savings: number;
  validUntil: string | null;
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

  /**
   * Active TAX_RULEs in a storefront-safe shape. Region-specific rules are left out: the
   * delivery state isn't known while browsing, so only rules that apply everywhere can be
   * folded into a displayed price.
   */
  async getPublicTaxRates(): Promise<{ taxRate: number; productIds: string[]; categoryIds: string[] }[]> {
    const now = new Date();
    const rules = await this.prisma.dynamicRule.findMany({
      where: {
        type: 'TAX_RULE',
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
    return rules
      .map((r) => ({ c: (r.conditions || {}) as Record<string, any>, a: (r.actions || {}) as Record<string, any> }))
      .filter(({ c, a }) => !c.region && Number(a.taxRate) > 0)
      .map(({ c, a }) => ({
        taxRate: Number(a.taxRate),
        productIds: Array.isArray(c.productIds) ? c.productIds : [],
        categoryIds: Array.isArray(c.categoryIds) ? c.categoryIds : [],
      }));
  }

  private static readonly OFFER_TYPES = new Set([
    'PRODUCT_DISCOUNT', 'QUANTITY_BASED_DISCOUNT', 'BOGO', 'BUY_X_AND_Y_FREE',
  ]);

  private loadActiveRules() {
    const now = new Date();
    return this.prisma.dynamicRule.findMany({
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
  }

  private offerAppliesToProduct(rule: { type: string; conditions: any }, item: CartItemContext): boolean {
    const c = (rule.conditions || {}) as Record<string, any>;
    if (rule.type === 'BOGO' || rule.type === 'BUY_X_AND_Y_FREE') return !!c.buyProductId && c.buyProductId === item.productId;
    const productIds: string[] = c.productIds || [];
    const categoryIds: string[] = c.categoryIds || [];
    if (productIds.length === 0 && categoryIds.length === 0) return true;
    return productIds.includes(item.productId) || (!!item.categoryId && categoryIds.includes(item.categoryId));
  }

  private describeOffer(
    rule: { id: string; name: string; type: string; description: string | null; conditions: any; actions: any; endDate: Date | null },
    item: CartItemContext,
  ): ProductOffer {
    const c = (rule.conditions || {}) as Record<string, any>;
    const a = (rule.actions || {}) as Record<string, any>;
    const qty = item.quantity;
    const price = item.unitPrice;
    const perUnit = (type: string, value: number) => (type === 'PERCENTAGE' ? (price * value) / 100 : value);
    const label = (type: string, value: number) => (type === 'PERCENTAGE' ? `${Number(value)}% off` : `₹${Number(value)} off per unit`);

    let summary = rule.name;
    let condition: string | null = null;
    let need = 0;
    let eligible = true;
    let savings = 0;

    if (rule.type === 'PRODUCT_DISCOUNT') {
      const min = Number(c.minQty) || 0;
      summary = label(a.discountType, a.discountValue);
      if (min > 0) { condition = `Buy ${min}+ units`; need = Math.max(0, min - qty); eligible = qty >= min; }
      savings = eligible ? Math.min(price, perUnit(a.discountType, a.discountValue)) * qty : 0;
    } else if (rule.type === 'QUANTITY_BASED_DISCOUNT') {
      const tiers: any[] = [...(a.tiers || [])].sort((x, y) => x.minQty - y.minQty);
      const first = tiers[0];
      const best = [...tiers].reverse().find((t) => qty >= t.minQty);
      const top = tiers[tiers.length - 1];
      summary = top ? `Up to ${label(top.discountType, top.discountValue)} on bulk orders` : rule.name;
      if (first) { condition = `Buy ${first.minQty}+ units`; need = Math.max(0, first.minQty - qty); eligible = qty >= first.minQty; }
      savings = best ? Math.min(price, perUnit(best.discountType, best.discountValue)) * qty : 0;
    } else {
      // BOGO / BUY_X_AND_Y_FREE
      const buy = Number(c.buyQuantity) || 1;
      const free = Number(a.freeQuantity) || 1;
      summary = `Buy ${buy}, get ${free} free`;
      condition = `Buy ${buy} units`;
      need = Math.max(0, buy - qty);
      eligible = qty >= buy;
      savings = eligible ? Math.floor(qty / buy) * free * price : 0;
    }

    return {
      ruleId: rule.id,
      name: rule.name,
      type: rule.type,
      description: (rule.description || '').trim() || summary,
      summary,
      condition,
      unitsNeeded: need,
      eligible,
      savings,
      validUntil: rule.endDate ? rule.endDate.toISOString() : null,
    };
  }

  /** Offers for one product and the single offer that ends up applied (null = none). */
  private resolveOffers(rules: any[], item: CartItemContext): { offers: ProductOffer[]; appliedId: string | null } {
    const offers = rules
      .filter((r) => RulesEngineService.OFFER_TYPES.has(r.type) && this.offerAppliesToProduct(r, item))
      .map((r) => this.describeOffer(r, item));
    const choice = item.offerChoice;
    let appliedId: string | null = null;
    if (choice === 'none') {
      appliedId = null;
    } else if (choice && offers.some((o) => o.ruleId === choice && o.eligible)) {
      // The shopper's own pick, as long as its condition is currently met.
      appliedId = choice;
    } else {
      // No pick, or the picked offer's condition is no longer met: it must not stay applied.
      // Fall back to the best offer whose condition is met right now (if any).
      const best = offers.filter((o) => o.eligible).sort((x, y) => y.savings - x.savings)[0];
      appliedId = best ? best.ruleId : null;
    }
    return { offers, appliedId };
  }

  /** Public: the offers shown on a product page and which one is currently applied. */
  async getProductOffers(params: { productId: string; quantity?: number; offerChoice?: string; inCart?: number }) {
    const product = await this.prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true, categoryId: true, unitPrice: true, moq: true },
    });
    if (!product) return { offers: [] as ProductOffer[], appliedId: null as string | null };
    const rules = await this.loadActiveRules();
    const item: CartItemContext = {
      productId: product.id,
      categoryId: product.categoryId || undefined,
      // Units of this product already in the cart (e.g. other variants) count towards the offer.
      quantity: Math.max(1, params.quantity || product.moq || 1) + Math.max(0, params.inCart || 0),
      unitPrice: Number(product.unitPrice),
      offerChoice: params.offerChoice,
    };
    return this.resolveOffers(rules, item);
  }

  async evaluateRules(input: RuleContext): Promise<RuleEvaluationResult> {
    let context = input;
    const rules = await this.loadActiveRules();

    // One offer per product: decide each product's winning offer, then evaluate every offer
    // rule only against the products it won.
    const winners = new Map<string, string | null>();
    for (const item of input.cartItems || []) {
      if (winners.has(item.productId)) continue;
      const same = (input.cartItems || []).filter((i) => i.productId === item.productId);
      const paid = same.find((i) => i.unitPrice > 0) || same[0];
      const choice = same.find((i) => i.offerChoice)?.offerChoice;
      // A product with variants has one cart line per variant; an offer's quantity condition is
      // about the product, so it is judged on the total across all of its lines.
      const total = same.reduce((sum, i) => sum + i.quantity, 0);
      winners.set(item.productId, this.resolveOffers(rules, { ...paid, quantity: total, offerChoice: choice }).appliedId);
    }

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
      context = input;
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

      if (RulesEngineService.OFFER_TYPES.has(rule.type)) {
        context = { ...input, cartItems: (input.cartItems || []).filter((i) => winners.get(i.productId) === rule.id) };
      } else {
        context = input;
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

  /**
   * Buy X get Y: qualifies when the buy product's units in the cart — summed over all of its lines,
   * so 1 Black + 1 Blue + 1 Red counts as 3 — reach the buy quantity.
   */
  private pushBuyXGetY(name: string, c: Record<string, any>, a: Record<string, any>, context: RuleContext, result: RuleEvaluationResult) {
    if (!context.cartItems || !c.buyProductId || !a.freeProductId) return;
    const buyQuantity = Number(c.buyQuantity) || 0;
    if (buyQuantity <= 0) return;
    const total = context.cartItems
      .filter((item) => item.productId === c.buyProductId)
      .reduce((sum, item) => sum + item.quantity, 0);
    if (total < buyQuantity) return;
    result.bogo.push({
      buyProductId: c.buyProductId,
      buyQuantity,
      freeProductId: a.freeProductId,
      freeQuantity: Number(a.freeQuantity) || 1,
      ruleName: name,
    });
  }

  private evaluateBogo(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    this.pushBuyXGetY(name, c, a, context, result);
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
    this.pushBuyXGetY(name, c, a, context, result);
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