import { computeRuleAdjustments, RuleEvaluationResult } from './rules-engine.service';

const empty = (): RuleEvaluationResult => ({
  productDiscounts: [], cartDiscount: null, paymentMethodDiscount: null, availablePaymentMethods: [], bogo: [],
  shipping: null, minimumOrderQuantities: [], taxes: [], checkoutRestrictions: [], quantityDiscounts: [],
  extraCharges: [], maximumOrderQuantities: [], hiddenProducts: [], hiddenPrices: [], nonPurchasable: [], customBadges: [],
});

describe('computeRuleAdjustments', () => {
  it('is all zero when no rule applies', () => {
    const adj = computeRuleAdjustments([{ productId: 'a', quantity: 3, unitPrice: 100 }], empty());
    expect(adj.totalDiscount).toBe(0);
    expect(adj.extraCharges).toBe(0);
    expect(adj.lines).toEqual([{ offerDiscount: 0, offerRuleName: null, qtyDiscount: 0, qtyRuleName: null }]);
  });

  it('applies a per-unit offer discount to each matching line, in line order', () => {
    const r = empty();
    r.productDiscounts = [
      { productId: 'a', discountAmount: 10, discountPercent: 10, ruleName: 'Deal' },
      { productId: 'a', discountAmount: 20, discountPercent: 10, ruleName: 'Deal' },
    ];
    const adj = computeRuleAdjustments(
      [{ productId: 'a', quantity: 2, unitPrice: 100 }, { productId: 'b', quantity: 1, unitPrice: 50 }, { productId: 'a', quantity: 1, unitPrice: 200 }],
      r,
    );
    expect(adj.lines.map((l) => l.offerDiscount)).toEqual([20, 0, 20]);
    expect(adj.productSavings).toBe(40);
    expect(adj.totalDiscount).toBe(40);
  });

  it('uses the highest quantity tier reached', () => {
    const r = empty();
    r.quantityDiscounts = [{ productId: 'a', ruleName: 'Bulk', tiers: [{ minQty: 50, discountType: 'PERCENTAGE', discountValue: 3 }, { minQty: 200, discountType: 'PERCENTAGE', discountValue: 5 }] }];
    expect(computeRuleAdjustments([{ productId: 'a', quantity: 49, unitPrice: 100 }], r).qtySavings).toBe(0);
    expect(computeRuleAdjustments([{ productId: 'a', quantity: 50, unitPrice: 100 }], r).qtySavings).toBe(150);
    expect(computeRuleAdjustments([{ productId: 'a', quantity: 200, unitPrice: 100 }], r).lines[0]).toEqual({ offerDiscount: 0, offerRuleName: null, qtyDiscount: 1000, qtyRuleName: 'Bulk' });
  });

  it('never discounts a line below zero', () => {
    const r = empty();
    r.productDiscounts = [{ productId: 'a', discountAmount: 500, discountPercent: 100, ruleName: 'Big' }];
    r.quantityDiscounts = [{ productId: 'a', ruleName: 'Flat', tiers: [{ minQty: 1, discountType: 'FLAT', discountValue: 50 }] }];
    const adj = computeRuleAdjustments([{ productId: 'a', quantity: 2, unitPrice: 100 }], r);
    expect(adj.lines[0].offerDiscount).toBe(200);
    expect(adj.lines[0].qtyDiscount).toBe(0);
  });

  it('adds cart and payment-method discounts and totals extra charges', () => {
    const r = empty();
    r.cartDiscount = { discountAmount: 4000, discountPercent: 2, ruleName: 'Cart 2%' };
    r.paymentMethodDiscount = { discountAmount: 2000, ruleName: 'Bank 1%' };
    r.extraCharges = [{ chargeAmount: 99.5, chargeLabel: 'Packing', ruleName: 'Pack' }];
    const adj = computeRuleAdjustments([{ productId: 'a', quantity: 1, unitPrice: 200000 }], r);
    expect(adj.cartDiscount).toBe(4000);
    expect(adj.paymentDiscount).toBe(2000);
    expect(adj.totalDiscount).toBe(6000);
    expect(adj.extraCharges).toBe(99.5);
    expect(adj.cartDiscountRuleName).toBe('Cart 2%');
  });
});
