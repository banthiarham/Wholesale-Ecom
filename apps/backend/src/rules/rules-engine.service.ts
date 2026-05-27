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
}

export interface RuleEvaluationResult {
  productDiscounts: { productId: string; discountAmount: number; discountPercent: number; ruleName: string }[];
  cartDiscount: { discountAmount: number; discountPercent: number; ruleName: string } | null;
  paymentMethodDiscount: { discountAmount: number; ruleName: string } | null;
  availablePaymentMethods: { method: string; minQty: number | null }[];
  bogo: { buyProductId: string; buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[];
  shipping: { shippingType: string; cost: number; ruleName: string } | null;
  minimumOrderQuantities: { productId?: string; minQty: number; ruleName: string }[];
  taxes: { taxRate: number; taxLabel: string; ruleName: string }[];
  checkoutRestrictions: { restricted: boolean; message: string; ruleName: string }[];
  quantityDiscounts: { productId?: string; tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }[];
  extraCharges: { chargeAmount: number; chargeLabel: string; ruleName: string }[];
  maximumOrderQuantities: { productId?: string; maxQty: number; ruleName: string }[];
  hiddenProducts: string[];
  hiddenPrices: string[];
  nonPurchasable: { productId: string; message?: string }[];
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
    };

    for (const rule of rules) {
      const c = rule.conditions as Record<string, any>;
      const a = rule.actions as Record<string, any>;

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
    const roleIds: string[] = c.roleIds || [];
    if (roleIds.length === 0) return true;
    return !!context.userRole && roleIds.includes(context.userRole);
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
    result.taxes.push({ taxRate: a.taxRate, taxLabel: a.taxLabel || 'Tax', ruleName: name });
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
    const productIds: string[] = c.productIds || [];
    result.hiddenProducts.push(...productIds);
  }

  private evaluateHiddenPrice(
    _id: string, name: string, c: Record<string, any>, _a: Record<string, any>,
    context: RuleContext, result: RuleEvaluationResult,
  ) {
    if (!this.matchesRole(c, context)) return;
    const productIds: string[] = c.productIds || [];
    result.hiddenPrices.push(...productIds);
  }

  private evaluateNonPurchasable(
    _id: string, name: string, c: Record<string, any>, a: Record<string, any>,
    _context: RuleContext, result: RuleEvaluationResult,
  ) {
    const productIds: string[] = c.productIds || [];
    for (const pid of productIds) {
      result.nonPurchasable.push({ productId: pid, message: a.message });
    }
  }
}