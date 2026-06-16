import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RulesEngineService, RuleContext, RuleEvaluationResult } from './rules-engine.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for a rule row returned by prisma.dynamicRule.findMany */
interface MockRule {
  id: string;
  name: string;
  type: string;
  priority: number;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  createdAt: Date;
}

const makeRule = (overrides: Partial<MockRule> = {}): MockRule => ({
  id: 'rule-1',
  name: 'Test Rule',
  type: 'PRODUCT_DISCOUNT',
  priority: 1,
  isActive: true,
  startDate: null,
  endDate: null,
  conditions: {},
  actions: {},
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

const makeContext = (overrides: Partial<RuleContext> = {}): RuleContext => ({
  userId: 'user-1',
  userRole: 'wholesale',
  cartItems: [
    { productId: 'prod-1', categoryId: 'cat-1', quantity: 5, unitPrice: 100 },
    { productId: 'prod-2', categoryId: 'cat-2', quantity: 2, unitPrice: 50 },
  ],
  subtotal: 600,
  paymentMethod: 'bank_transfer',
  shippingRegion: 'US',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('RulesEngineService', () => {
  let service: RulesEngineService;
  let prisma: { dynamicRule: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      dynamicRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesEngineService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RulesEngineService>(RulesEngineService);
  });

  // -----------------------------------------------------------------------
  // Baseline: no active rules
  // -----------------------------------------------------------------------
  describe('when no active rules exist', () => {
    it('returns an empty result with all default values', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([]);
      const result = await service.evaluateRules(makeContext());
      expect(result.productDiscounts).toEqual([]);
      expect(result.cartDiscount).toBeNull();
      expect(result.paymentMethodDiscount).toBeNull();
      expect(result.availablePaymentMethods).toEqual([]);
      expect(result.bogo).toEqual([]);
      expect(result.shipping).toBeNull();
      expect(result.minimumOrderQuantities).toEqual([]);
      expect(result.taxes).toEqual([]);
      expect(result.checkoutRestrictions).toEqual([]);
      expect(result.quantityDiscounts).toEqual([]);
      expect(result.extraCharges).toEqual([]);
      expect(result.maximumOrderQuantities).toEqual([]);
      expect(result.hiddenProducts).toEqual([]);
      expect(result.hiddenPrices).toEqual([]);
      expect(result.nonPurchasable).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Prisma query: date window filtering
  // -----------------------------------------------------------------------
  describe('prisma date-window filtering', () => {
    it('passes isActive=true and date-window OR clauses to findMany', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([]);
      await service.evaluateRules(makeContext());

      expect(prisma.dynamicRule.findMany).toHaveBeenCalledTimes(1);
      const callArg = prisma.dynamicRule.findMany.mock.calls[0][0];
      expect(callArg.where.isActive).toBe(true);
      expect(callArg.where.OR).toBeDefined();
      expect(callArg.where.OR).toHaveLength(4);
      // null/null (always active), start<=now && end>=now, start<=now && end null, start null && end>=now
      expect(callArg.orderBy).toEqual([{ priority: 'asc' }, { createdAt: 'desc' }]);
    });
  });

  // -----------------------------------------------------------------------
  // Priority ordering
  // -----------------------------------------------------------------------
  describe('priority ordering', () => {
    it('processes rules in prisma-returned order (ordered by priority asc, createdAt desc)', async () => {
      const lowPriority = makeRule({
        id: 'low',
        name: 'Low Priority Cart Discount',
        type: 'CART_DISCOUNT',
        priority: 10,
        conditions: { minSubtotal: 0 },
        actions: { discountType: 'FIXED', discountValue: 10 },
      });
      const highPriority = makeRule({
        id: 'high',
        name: 'High Priority Cart Discount',
        type: 'CART_DISCOUNT',
        priority: 1,
        conditions: { minSubtotal: 0 },
        actions: { discountType: 'FIXED', discountValue: 50 },
      });
      // Prisma returns them already ordered; the last CART_DISCOUNT wins (it overwrites)
      prisma.dynamicRule.findMany.mockResolvedValueOnce([highPriority, lowPriority]);
      const result = await service.evaluateRules(makeContext());
      // The second rule evaluated overwrites cartDiscount
      expect(result.cartDiscount!.ruleName).toBe('Low Priority Cart Discount');
      expect(result.cartDiscount!.discountAmount).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // PRODUCT_DISCOUNT
  // -----------------------------------------------------------------------
  describe('PRODUCT_DISCOUNT', () => {
    it('applies percentage discount to matching products', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { productIds: ['prod-1'] },
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.productDiscounts).toHaveLength(1);
      expect(result.productDiscounts[0]).toEqual({
        productId: 'prod-1',
        discountAmount: 10, // 100 * 10 / 100
        discountPercent: 10,
        ruleName: 'Test Rule',
      });
    });

    it('applies fixed discount to matching products', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { productIds: ['prod-1'] },
          actions: { discountType: 'FIXED', discountValue: 15 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.productDiscounts).toHaveLength(1);
      expect(result.productDiscounts[0].discountAmount).toBe(15);
      expect(result.productDiscounts[0].discountPercent).toBe(15); // 15/100 * 100
    });

    it('filters products by categoryId', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { categoryIds: ['cat-2'] },
          actions: { discountType: 'PERCENTAGE', discountValue: 20 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.productDiscounts).toHaveLength(1);
      expect(result.productDiscounts[0].productId).toBe('prod-2');
      expect(result.productDiscounts[0].discountPercent).toBe(20);
    });

    it('applies discount to all products when no productIds/categoryIds in conditions', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: {},
          actions: { discountType: 'PERCENTAGE', discountValue: 5 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      // Both cart items match
      expect(result.productDiscounts).toHaveLength(2);
    });

    it('respects minQty condition - skips items below minQty', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { productIds: ['prod-1', 'prod-2'], minQty: 3 },
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      // prod-1 has qty 5 (>=3), prod-2 has qty 2 (<3)
      expect(result.productDiscounts).toHaveLength(1);
      expect(result.productDiscounts[0].productId).toBe('prod-1');
    });

    it('returns no discounts when no products match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { productIds: ['nonexistent'] },
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.productDiscounts).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // CART_DISCOUNT
  // -----------------------------------------------------------------------
  describe('CART_DISCOUNT', () => {
    it('applies percentage cart discount when subtotal meets minSubtotal', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CART_DISCOUNT',
          conditions: { minSubtotal: 500 },
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: 600 }));
      expect(result.cartDiscount).toEqual({
        discountAmount: 60, // 600 * 10 / 100
        discountPercent: 10,
        ruleName: 'Test Rule',
      });
    });

    it('applies fixed cart discount', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CART_DISCOUNT',
          conditions: { minSubtotal: 0 },
          actions: { discountType: 'FIXED', discountValue: 25 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: 200 }));
      expect(result.cartDiscount!.discountAmount).toBe(25);
      expect(result.cartDiscount!.discountPercent).toBe(12.5); // 25/200 * 100
    });

    it('does not apply when subtotal is below minSubtotal', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CART_DISCOUNT',
          conditions: { minSubtotal: 1000 },
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: 500 }));
      expect(result.cartDiscount).toBeNull();
    });

    it('does not apply when subtotal is undefined', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CART_DISCOUNT',
          conditions: { minSubtotal: 0 },
          actions: { discountType: 'FIXED', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: undefined }));
      // subtotal is falsy (undefined), so the condition `context.subtotal && ...` is false
      expect(result.cartDiscount).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // PAYMENT_METHOD_DISCOUNT
  // -----------------------------------------------------------------------
  describe('PAYMENT_METHOD_DISCOUNT', () => {
    it('applies percentage discount when payment method matches', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PAYMENT_METHOD_DISCOUNT',
          conditions: { paymentMethod: 'bank_transfer' },
          actions: { discountType: 'PERCENTAGE', discountValue: 5 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: 200, paymentMethod: 'bank_transfer' }));
      expect(result.paymentMethodDiscount).toEqual({
        discountAmount: 10, // 200 * 5 / 100
        ruleName: 'Test Rule',
      });
    });

    it('applies fixed discount when payment method matches', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PAYMENT_METHOD_DISCOUNT',
          conditions: { paymentMethod: 'credit_card' },
          actions: { discountType: 'FIXED', discountValue: 15 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ paymentMethod: 'credit_card' }));
      expect(result.paymentMethodDiscount!.discountAmount).toBe(15);
    });

    it('does not apply when payment method does not match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PAYMENT_METHOD_DISCOUNT',
          conditions: { paymentMethod: 'credit_card' },
          actions: { discountType: 'FIXED', discountValue: 15 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ paymentMethod: 'bank_transfer' }));
      expect(result.paymentMethodDiscount).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // REQUIRED_QTY_FOR_PAYMENT_METHOD
  // -----------------------------------------------------------------------
  describe('REQUIRED_QTY_FOR_PAYMENT_METHOD', () => {
    it('returns null minQty when total quantity meets threshold', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'REQUIRED_QTY_FOR_PAYMENT_METHOD',
          conditions: { paymentMethod: 'bank_transfer', minQty: 5 },
          actions: {},
        }),
      ]);
      // cart has 5+2 = 7 total qty
      const result = await service.evaluateRules(makeContext());
      expect(result.availablePaymentMethods).toHaveLength(1);
      expect(result.availablePaymentMethods[0]).toEqual({
        method: 'bank_transfer',
        minQty: null,
      });
    });

    it('returns minQty when total quantity is below threshold', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'REQUIRED_QTY_FOR_PAYMENT_METHOD',
          conditions: { paymentMethod: 'bank_transfer', minQty: 100 },
          actions: {},
        }),
      ]);
      // cart has 7 total qty, below 100
      const result = await service.evaluateRules(makeContext());
      expect(result.availablePaymentMethods[0].minQty).toBe(100);
    });

    it('handles empty cart (totalQty = 0)', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'REQUIRED_QTY_FOR_PAYMENT_METHOD',
          conditions: { paymentMethod: 'cod', minQty: 10 },
          actions: {},
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ cartItems: [] }));
      expect(result.availablePaymentMethods[0].minQty).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // BOGO
  // -----------------------------------------------------------------------
  describe('BOGO', () => {
    it('creates BOGO entry when buy product meets quantity threshold', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'BOGO',
          conditions: { buyProductId: 'prod-1', buyQuantity: 3 },
          actions: { freeProductId: 'prod-2', freeQuantity: 1 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.bogo).toHaveLength(1);
      expect(result.bogo[0]).toEqual({
        buyProductId: 'prod-1',
        buyQuantity: 3,
        freeProductId: 'prod-2',
        freeQuantity: 1,
        ruleName: 'Test Rule',
      });
    });

    it('does not create BOGO when buy quantity is insufficient', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'BOGO',
          conditions: { buyProductId: 'prod-2', buyQuantity: 5 },
          actions: { freeProductId: 'prod-1', freeQuantity: 1 },
        }),
      ]);
      // prod-2 only has qty 2, needs 5
      const result = await service.evaluateRules(makeContext());
      expect(result.bogo).toHaveLength(0);
    });

    it('defaults freeQuantity to 1 when not specified in actions', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'BOGO',
          conditions: { buyProductId: 'prod-1', buyQuantity: 1 },
          actions: { freeProductId: 'prod-2' }, // no freeQuantity
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.bogo[0].freeQuantity).toBe(1);
    });

    it('skips BOGO when cartItems is undefined', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'BOGO',
          conditions: { buyProductId: 'prod-1', buyQuantity: 1 },
          actions: { freeProductId: 'prod-2' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ cartItems: undefined }));
      expect(result.bogo).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // SHIPPING_RULE
  // -----------------------------------------------------------------------
  describe('SHIPPING_RULE', () => {
    it('applies flat-rate shipping when region matches and subtotal meets minOrderValue', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'SHIPPING_RULE',
          conditions: { region: 'US', minOrderValue: 100 },
          actions: { shippingType: 'FLAT_RATE', flatRate: 9.99 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: 200, shippingRegion: 'US' }));
      expect(result.shipping).toEqual({
        shippingType: 'FLAT_RATE',
        cost: 9.99,
        ruleName: 'Test Rule',
      });
    });

    it('does not apply when region does not match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'SHIPPING_RULE',
          conditions: { region: 'EU' },
          actions: { shippingType: 'FLAT_RATE', flatRate: 15 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ shippingRegion: 'US' }));
      expect(result.shipping).toBeNull();
    });

    it('does not apply when subtotal is below minOrderValue', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'SHIPPING_RULE',
          conditions: { minOrderValue: 5000 },
          actions: { shippingType: 'FLAT_RATE', flatRate: 5 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: 100 }));
      expect(result.shipping).toBeNull();
    });

    it('uses 0 as default flatRate if not specified', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'SHIPPING_RULE',
          conditions: {},
          actions: { shippingType: 'FLAT_RATE' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: 50 }));
      expect(result.shipping!.cost).toBe(0);
    });

    it('only keeps the first shipping rule (subsequent ones are ignored)', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          id: 'r1',
          name: 'First Shipping',
          type: 'SHIPPING_RULE',
          conditions: {},
          actions: { shippingType: 'FLAT_RATE', flatRate: 10 },
        }),
        makeRule({
          id: 'r2',
          name: 'Second Shipping',
          type: 'SHIPPING_RULE',
          conditions: {},
          actions: { shippingType: 'FLAT_RATE', flatRate: 20 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: 100 }));
      expect(result.shipping!.ruleName).toBe('First Shipping');
      expect(result.shipping!.cost).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // MINIMUM_ORDER_QUANTITY
  // -----------------------------------------------------------------------
  describe('MINIMUM_ORDER_QUANTITY', () => {
    it('flags products whose quantity is below the minimum', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'MINIMUM_ORDER_QUANTITY',
          conditions: { productIds: ['prod-1', 'prod-2'] },
          actions: { minQty: 10 },
        }),
      ]);
      // prod-1 qty=5, prod-2 qty=2; both below 10
      const result = await service.evaluateRules(makeContext());
      expect(result.minimumOrderQuantities).toHaveLength(2);
      expect(result.minimumOrderQuantities[0].productId).toBe('prod-1');
      expect(result.minimumOrderQuantities[0].minQty).toBe(10);
      expect(result.minimumOrderQuantities[1].productId).toBe('prod-2');
    });

    it('does not flag products that meet the minimum', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'MINIMUM_ORDER_QUANTITY',
          conditions: { productIds: ['prod-1'] },
          actions: { minQty: 3 },
        }),
      ]);
      // prod-1 qty=5, meets minimum
      const result = await service.evaluateRules(makeContext());
      expect(result.minimumOrderQuantities).toHaveLength(0);
    });

    it('skips rule when specified products are not in cart', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'MINIMUM_ORDER_QUANTITY',
          conditions: { productIds: ['prod-999'] },
          actions: { minQty: 5 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.minimumOrderQuantities).toHaveLength(0);
    });

    it('applies to all cart items when no productIds/categoryIds specified', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'MINIMUM_ORDER_QUANTITY',
          conditions: {},
          actions: { minQty: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      // Both items below minQty 10
      expect(result.minimumOrderQuantities).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // TAX_RULE
  // -----------------------------------------------------------------------
  describe('TAX_RULE', () => {
    it('adds a tax entry when region matches and products match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'TAX_RULE',
          conditions: { region: 'US', productIds: ['prod-1'] },
          actions: { taxRate: 8.5, taxLabel: 'Sales Tax' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ shippingRegion: 'US' }));
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0]).toEqual({
        taxRate: 8.5,
        taxLabel: 'Sales Tax',
        ruleName: 'Test Rule',
      });
    });

    it('skips when region does not match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'TAX_RULE',
          conditions: { region: 'EU' },
          actions: { taxRate: 20, taxLabel: 'VAT' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ shippingRegion: 'US' }));
      expect(result.taxes).toHaveLength(0);
    });

    it('defaults taxLabel to "Tax" when not provided', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'TAX_RULE',
          conditions: {},
          actions: { taxRate: 5 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.taxes[0].taxLabel).toBe('Tax');
    });
  });

  // -----------------------------------------------------------------------
  // CHECKOUT_RESTRICTION
  // -----------------------------------------------------------------------
  describe('CHECKOUT_RESTRICTION', () => {
    it('adds restriction when role matches and products match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CHECKOUT_RESTRICTION',
          conditions: { roleIds: ['wholesale'], productIds: ['prod-1'] },
          actions: { message: 'Wholesale users cannot purchase this' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'wholesale' }));
      expect(result.checkoutRestrictions).toHaveLength(1);
      expect(result.checkoutRestrictions[0]).toEqual({
        restricted: true,
        message: 'Wholesale users cannot purchase this',
        ruleName: 'Test Rule',
      });
    });

    it('skips restriction when role does not match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CHECKOUT_RESTRICTION',
          conditions: { roleIds: ['retail'], productIds: ['prod-1'] },
          actions: { message: 'Restricted' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'wholesale' }));
      expect(result.checkoutRestrictions).toHaveLength(0);
    });

    it('applies when no roleIds specified (matches all roles)', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CHECKOUT_RESTRICTION',
          conditions: { productIds: ['prod-1'] },
          actions: { message: 'No one can buy this' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'guest' }));
      expect(result.checkoutRestrictions).toHaveLength(1);
    });

    it('uses default message when none provided', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          name: 'VIP Only',
          type: 'CHECKOUT_RESTRICTION',
          conditions: {},
          actions: {},
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.checkoutRestrictions[0].message).toBe('Checkout restricted by rule: VIP Only');
    });
  });

  // -----------------------------------------------------------------------
  // QUANTITY_BASED_DISCOUNT
  // -----------------------------------------------------------------------
  describe('QUANTITY_BASED_DISCOUNT', () => {
    it('adds quantity discount tiers for matching products', async () => {
      const tiers = [
        { minQty: 10, discountType: 'PERCENTAGE', discountValue: 5 },
        { minQty: 50, discountType: 'PERCENTAGE', discountValue: 10 },
      ];
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'QUANTITY_BASED_DISCOUNT',
          conditions: { productIds: ['prod-1'] },
          actions: { tiers },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.quantityDiscounts).toHaveLength(1);
      expect(result.quantityDiscounts[0].productId).toBe('prod-1');
      expect(result.quantityDiscounts[0].tiers).toEqual(tiers);
    });

    it('skips when no tiers are defined', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'QUANTITY_BASED_DISCOUNT',
          conditions: { productIds: ['prod-1'] },
          actions: { tiers: [] },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.quantityDiscounts).toHaveLength(0);
    });

    it('skips when specified products are not in cart', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'QUANTITY_BASED_DISCOUNT',
          conditions: { productIds: ['prod-999'] },
          actions: { tiers: [{ minQty: 5, discountType: 'PERCENTAGE', discountValue: 5 }] },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.quantityDiscounts).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // EXTRA_CHARGE
  // -----------------------------------------------------------------------
  describe('EXTRA_CHARGE', () => {
    it('calculates percentage-based extra charge on matching products', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'EXTRA_CHARGE',
          conditions: { productIds: ['prod-1'] },
          actions: { chargeType: 'PERCENTAGE', chargeValue: 5, chargeLabel: 'Handling Fee' },
        }),
      ]);
      // prod-1: unitPrice=100, qty=5 => charge = 100*5*5/100 = 25
      const result = await service.evaluateRules(makeContext());
      expect(result.extraCharges).toHaveLength(1);
      expect(result.extraCharges[0].chargeAmount).toBe(25);
      expect(result.extraCharges[0].chargeLabel).toBe('Handling Fee');
    });

    it('calculates fixed extra charge', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'EXTRA_CHARGE',
          conditions: {},
          actions: { chargeType: 'FIXED', chargeValue: 7.5, chargeLabel: 'Service Fee' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.extraCharges[0].chargeAmount).toBe(7.5);
    });

    it('defaults chargeLabel to "Extra Charge"', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'EXTRA_CHARGE',
          conditions: {},
          actions: { chargeType: 'FIXED', chargeValue: 5 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.extraCharges[0].chargeLabel).toBe('Extra Charge');
    });
  });

  // -----------------------------------------------------------------------
  // BUY_X_AND_Y_FREE
  // -----------------------------------------------------------------------
  describe('BUY_X_AND_Y_FREE', () => {
    it('creates BOGO-style entry when buy product meets quantity', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'BUY_X_AND_Y_FREE',
          conditions: { buyProductId: 'prod-1', buyQuantity: 2 },
          actions: { freeProductId: 'prod-free', freeQuantity: 2 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.bogo).toHaveLength(1);
      expect(result.bogo[0]).toEqual({
        buyProductId: 'prod-1',
        buyQuantity: 2,
        freeProductId: 'prod-free',
        freeQuantity: 2,
        ruleName: 'Test Rule',
      });
    });

    it('does not create entry when buy quantity is insufficient', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'BUY_X_AND_Y_FREE',
          conditions: { buyProductId: 'prod-2', buyQuantity: 10 },
          actions: { freeProductId: 'prod-free', freeQuantity: 1 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.bogo).toHaveLength(0);
    });

    it('defaults freeQuantity to 1 when not specified', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'BUY_X_AND_Y_FREE',
          conditions: { buyProductId: 'prod-1', buyQuantity: 1 },
          actions: { freeProductId: 'prod-free' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.bogo[0].freeQuantity).toBe(1);
    });

    it('skips when cartItems is undefined', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'BUY_X_AND_Y_FREE',
          conditions: { buyProductId: 'prod-1', buyQuantity: 1 },
          actions: { freeProductId: 'prod-free' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ cartItems: undefined }));
      expect(result.bogo).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // MAXIMUM_ORDER_QUANTITY
  // -----------------------------------------------------------------------
  describe('MAXIMUM_ORDER_QUANTITY', () => {
    it('flags products whose quantity exceeds maxQty', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'MAXIMUM_ORDER_QUANTITY',
          conditions: { productIds: ['prod-1'] },
          actions: { maxQty: 3 },
        }),
      ]);
      // prod-1 has qty=5, which exceeds maxQty=3
      const result = await service.evaluateRules(makeContext());
      expect(result.maximumOrderQuantities).toHaveLength(1);
      expect(result.maximumOrderQuantities[0]).toEqual({
        productId: 'prod-1',
        maxQty: 3,
        ruleName: 'Test Rule',
      });
    });

    it('does not flag products within maxQty', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'MAXIMUM_ORDER_QUANTITY',
          conditions: { productIds: ['prod-1'] },
          actions: { maxQty: 10 },
        }),
      ]);
      // prod-1 qty=5, within maxQty=10
      const result = await service.evaluateRules(makeContext());
      expect(result.maximumOrderQuantities).toHaveLength(0);
    });

    it('defaults maxQty to 999 when not provided', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'MAXIMUM_ORDER_QUANTITY',
          conditions: {},
          actions: {}, // no maxQty
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      // Both items qty < 999, so nothing flagged
      expect(result.maximumOrderQuantities).toHaveLength(0);
    });

    it('skips when specified products are not in cart', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'MAXIMUM_ORDER_QUANTITY',
          conditions: { productIds: ['prod-999'] },
          actions: { maxQty: 1 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.maximumOrderQuantities).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // RESTRICT_PRODUCT_VISIBILITY (hiddenProducts)
  // -----------------------------------------------------------------------
  describe('RESTRICT_PRODUCT_VISIBILITY', () => {
    it('adds productIds to hiddenProducts when role matches', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'RESTRICT_PRODUCT_VISIBILITY',
          conditions: { roleIds: ['wholesale'], productIds: ['prod-1', 'prod-3'] },
          actions: {},
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'wholesale' }));
      expect(result.hiddenProducts).toContain('prod-1');
      expect(result.hiddenProducts).toContain('prod-3');
    });

    it('skips when role does not match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'RESTRICT_PRODUCT_VISIBILITY',
          conditions: { roleIds: ['retail'], productIds: ['prod-1'] },
          actions: {},
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'wholesale' }));
      expect(result.hiddenProducts).toHaveLength(0);
    });

    it('includes products matched by categoryId from the cart', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'RESTRICT_PRODUCT_VISIBILITY',
          conditions: { roleIds: ['wholesale'], categoryIds: ['cat-1'] },
          actions: {},
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'wholesale' }));
      // prod-1 is in cat-1
      expect(result.hiddenProducts).toContain('prod-1');
    });

    it('deduplicates productIds from direct and category matches', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'RESTRICT_PRODUCT_VISIBILITY',
          conditions: { roleIds: ['wholesale'], productIds: ['prod-1'], categoryIds: ['cat-1'] },
          actions: {},
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'wholesale' }));
      // prod-1 appears both directly and via category, but should be deduplicated
      const prod1Count = result.hiddenProducts.filter((p) => p === 'prod-1').length;
      expect(prod1Count).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // HIDDEN_PRICE
  // -----------------------------------------------------------------------
  describe('HIDDEN_PRICE', () => {
    it('adds productIds to hiddenPrices when role matches', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'HIDDEN_PRICE',
          conditions: { roleIds: ['guest'], productIds: ['prod-1'] },
          actions: {},
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'guest' }));
      expect(result.hiddenPrices).toContain('prod-1');
    });

    it('skips when role does not match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'HIDDEN_PRICE',
          conditions: { roleIds: ['retail'], productIds: ['prod-1'] },
          actions: {},
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'wholesale' }));
      expect(result.hiddenPrices).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // NON_PURCHASABLE
  // -----------------------------------------------------------------------
  describe('NON_PURCHASABLE', () => {
    it('marks products as non-purchasable when role matches', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'NON_PURCHASABLE',
          conditions: { roleIds: ['guest'], productIds: ['prod-1', 'prod-2'] },
          actions: { message: 'Guest cannot purchase' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'guest' }));
      expect(result.nonPurchasable).toHaveLength(2);
      expect(result.nonPurchasable[0]).toEqual({
        productId: 'prod-1',
        message: 'Guest cannot purchase',
      });
      expect(result.nonPurchasable[1]).toEqual({
        productId: 'prod-2',
        message: 'Guest cannot purchase',
      });
    });

    it('skips when role does not match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'NON_PURCHASABLE',
          conditions: { roleIds: ['retail'], productIds: ['prod-1'] },
          actions: { message: 'Not available' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'wholesale' }));
      expect(result.nonPurchasable).toHaveLength(0);
    });

    it('includes products matched by categoryId', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'NON_PURCHASABLE',
          conditions: { roleIds: ['wholesale'], categoryIds: ['cat-2'] },
          actions: { message: 'Restricted category' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'wholesale' }));
      // prod-2 is in cat-2
      expect(result.nonPurchasable.some((np) => np.productId === 'prod-2')).toBe(true);
    });

    it('applies when no roleIds specified (matches all roles)', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'NON_PURCHASABLE',
          conditions: { productIds: ['prod-1'] },
          actions: { message: 'Nobody can buy' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'any' }));
      expect(result.nonPurchasable).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // matchesProducts (tested indirectly)
  // -----------------------------------------------------------------------
  describe('matchesProducts (indirect)', () => {
    it('returns all cart items when conditions have no productIds or categoryIds', async () => {
      // Using PRODUCT_DISCOUNT with empty conditions targets all products
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: {},
          actions: { discountType: 'PERCENTAGE', discountValue: 5 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.productDiscounts).toHaveLength(2);
    });

    it('returns no items when productIds and categoryIds do not match any cart item', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { productIds: ['prod-999'], categoryIds: ['cat-999'] },
          actions: { discountType: 'PERCENTAGE', discountValue: 5 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.productDiscounts).toHaveLength(0);
    });

    it('matches items by productId even if categoryId does not match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { productIds: ['prod-1'], categoryIds: ['cat-999'] },
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      // prod-1 matches by productId
      expect(result.productDiscounts).toHaveLength(1);
      expect(result.productDiscounts[0].productId).toBe('prod-1');
    });

    it('matches items by categoryId even if productId does not match', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { productIds: ['prod-999'], categoryIds: ['cat-1'] },
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      // prod-1 is in cat-1
      expect(result.productDiscounts).toHaveLength(1);
      expect(result.productDiscounts[0].productId).toBe('prod-1');
    });

    it('returns empty when cart is empty', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: {},
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ cartItems: [] }));
      expect(result.productDiscounts).toHaveLength(0);
    });

    it('returns empty when cartItems is undefined', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: {},
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ cartItems: undefined }));
      expect(result.productDiscounts).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // matchesRole (tested indirectly)
  // -----------------------------------------------------------------------
  describe('matchesRole (indirect)', () => {
    it('returns true when roleIds is empty (all roles match)', async () => {
      // CHECKOUT_RESTRICTION with no roleIds should apply to any role
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CHECKOUT_RESTRICTION',
          conditions: { productIds: ['prod-1'] },
          actions: { message: 'Restricted for all' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'any_role' }));
      expect(result.checkoutRestrictions).toHaveLength(1);
    });

    it('returns false when userRole is undefined but roleIds are specified', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CHECKOUT_RESTRICTION',
          conditions: { roleIds: ['wholesale'], productIds: ['prod-1'] },
          actions: { message: 'Restricted' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: undefined }));
      expect(result.checkoutRestrictions).toHaveLength(0);
    });

    it('returns true when userRole matches one of the roleIds', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CHECKOUT_RESTRICTION',
          conditions: { roleIds: ['wholesale', 'retail'], productIds: ['prod-1'] },
          actions: { message: 'Restricted' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'retail' }));
      expect(result.checkoutRestrictions).toHaveLength(1);
    });

    it('returns false when userRole is not in roleIds', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CHECKOUT_RESTRICTION',
          conditions: { roleIds: ['admin'], productIds: ['prod-1'] },
          actions: { message: 'Admin only' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ userRole: 'guest' }));
      expect(result.checkoutRestrictions).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles empty cart gracefully across all rule types', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: {},
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
        makeRule({
          id: 'r2',
          name: 'Min Qty Rule',
          type: 'MINIMUM_ORDER_QUANTITY',
          conditions: {},
          actions: { minQty: 5 },
        }),
        makeRule({
          id: 'r3',
          name: 'BOGO Rule',
          type: 'BOGO',
          conditions: { buyProductId: 'prod-1', buyQuantity: 1 },
          actions: { freeProductId: 'prod-free', freeQuantity: 1 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ cartItems: [] }));
      // No products to apply discounts to
      expect(result.productDiscounts).toHaveLength(0);
      // No items to flag for minimum order quantity
      expect(result.minimumOrderQuantities).toHaveLength(0);
      // No items for BOGO
      expect(result.bogo).toHaveLength(0);
    });

    it('handles undefined cartItems gracefully', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: {},
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ cartItems: undefined }));
      expect(result.productDiscounts).toHaveLength(0);
    });

    it('handles rules with zero-value actions', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CART_DISCOUNT',
          conditions: { minSubtotal: 0 },
          actions: { discountType: 'PERCENTAGE', discountValue: 0 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({ subtotal: 100 }));
      expect(result.cartDiscount).not.toBeNull();
      expect(result.cartDiscount!.discountAmount).toBe(0);
      expect(result.cartDiscount!.discountPercent).toBe(0);
    });

    it('handles FIXED product discount with zero unitPrice', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { productIds: ['prod-free'] },
          actions: { discountType: 'FIXED', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({
        cartItems: [{ productId: 'prod-free', quantity: 1, unitPrice: 0 }],
      }));
      expect(result.productDiscounts).toHaveLength(1);
      expect(result.productDiscounts[0].discountAmount).toBe(10);
      expect(result.productDiscounts[0].discountPercent).toBe(0); // 10/0 => 0 guard
    });

    it('handles FIXED cart discount with zero subtotal', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'CART_DISCOUNT',
          conditions: { minSubtotal: 0 },
          actions: { discountType: 'FIXED', discountValue: 10 },
        }),
      ]);
      // subtotal of 0 passes minSubtotal(0) check, but subtotal is falsy => the condition
      // `context.subtotal && context.subtotal >= minSubtotal` is false when subtotal is 0
      const result = await service.evaluateRules(makeContext({ subtotal: 0 }));
      expect(result.cartDiscount).toBeNull();
    });

    it('processes multiple rule types in a single pass', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          id: 'r1',
          name: 'Product Discount',
          type: 'PRODUCT_DISCOUNT',
          conditions: { productIds: ['prod-1'] },
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
        makeRule({
          id: 'r2',
          name: 'Cart Discount',
          type: 'CART_DISCOUNT',
          conditions: { minSubtotal: 0 },
          actions: { discountType: 'FIXED', discountValue: 20 },
        }),
        makeRule({
          id: 'r3',
          name: 'Tax Rule',
          type: 'TAX_RULE',
          conditions: {},
          actions: { taxRate: 8, taxLabel: 'State Tax' },
        }),
        makeRule({
          id: 'r4',
          name: 'Checkout Restriction',
          type: 'CHECKOUT_RESTRICTION',
          conditions: { roleIds: ['wholesale'] },
          actions: { message: 'No wholesale checkout' },
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      expect(result.productDiscounts).toHaveLength(1);
      expect(result.cartDiscount).not.toBeNull();
      expect(result.taxes).toHaveLength(1);
      expect(result.checkoutRestrictions).toHaveLength(1);
    });

    it('ignores unknown rule types gracefully', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'UNKNOWN_TYPE' as any,
          conditions: {},
          actions: {},
        }),
      ]);
      const result = await service.evaluateRules(makeContext());
      // All result arrays should be empty / null since no known rule type was processed
      expect(result.productDiscounts).toEqual([]);
      expect(result.cartDiscount).toBeNull();
      expect(result.bogo).toEqual([]);
    });

    it('handles cart items without categoryId', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PRODUCT_DISCOUNT',
          conditions: { categoryIds: ['cat-1'] },
          actions: { discountType: 'PERCENTAGE', discountValue: 10 },
        }),
      ]);
      const result = await service.evaluateRules(makeContext({
        cartItems: [{ productId: 'prod-x', quantity: 1, unitPrice: 50 }], // no categoryId
      }));
      // prod-x has no categoryId, so it should not match categoryIds filter
      expect(result.productDiscounts).toHaveLength(0);
    });

    it('handles PERCENTAGE payment method discount without subtotal', async () => {
      prisma.dynamicRule.findMany.mockResolvedValueOnce([
        makeRule({
          type: 'PAYMENT_METHOD_DISCOUNT',
          conditions: { paymentMethod: 'bank_transfer' },
          actions: { discountType: 'PERCENTAGE', discountValue: 5 },
        }),
      ]);
      // When discountType is PERCENTAGE but subtotal is undefined, falls back to FIXED path
      const result = await service.evaluateRules(makeContext({
        paymentMethod: 'bank_transfer',
        subtotal: undefined,
      }));
      expect(result.paymentMethodDiscount).not.toBeNull();
    });
  });
});