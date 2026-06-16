import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RulesEnforcementService } from './rules-enforcement.service';
import {
  RulesEngineService,
  RuleContext,
  RuleEvaluationResult,
} from './rules-engine.service';

function emptyResult(): RuleEvaluationResult {
  return {
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
}

describe('RulesEnforcementService', () => {
  let service: RulesEnforcementService;
  let rulesEngine: { evaluateRules: jest.Mock<Promise<RuleEvaluationResult>> };

  beforeEach(async () => {
    rulesEngine = { evaluateRules: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesEnforcementService,
        { provide: RulesEngineService, useValue: rulesEngine },
      ],
    }).compile();

    service = module.get<RulesEnforcementService>(RulesEnforcementService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseContext: RuleContext = {
    userId: 'user-1',
    userRole: 'RETAILER',
    cartItems: [
      { productId: 'prod-1', quantity: 5, unitPrice: 100, categoryId: 'cat-1' },
      { productId: 'prod-2', quantity: 2, unitPrice: 50, categoryId: 'cat-2' },
    ],
    subtotal: 600,
    paymentMethod: 'CREDIT_CARD',
    shippingRegion: 'US',
  };

  // ── enforceCartRules ────────────────────────────────────────────────

  describe('enforceCartRules', () => {
    it('should throw BadRequestException for non-purchasable product', async () => {
      const result = {
        ...emptyResult(),
        nonPurchasable: [
          { productId: 'prod-1', message: 'Product not available' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceCartRules(baseContext)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.enforceCartRules(baseContext)).rejects.toThrow(
        'Product not available',
      );
    });

    it('should use default message when nonPurchasable has no message', async () => {
      const result = {
        ...emptyResult(),
        nonPurchasable: [{ productId: 'prod-1' }],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceCartRules(baseContext)).rejects.toThrow(
        'Product prod-1 is not available for purchase',
      );
    });

    it('should throw BadRequestException for exceeding maximum order quantity', async () => {
      const result = {
        ...emptyResult(),
        maximumOrderQuantities: [
          { productId: 'prod-1', maxQty: 3, ruleName: 'MaxQtyRule' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceCartRules(baseContext)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.enforceCartRules(baseContext)).rejects.toThrow(
        'Product prod-1 exceeds maximum quantity of 3 (rule: MaxQtyRule)',
      );
    });

    it('should combine multiple maximumOrderQuantities messages with semicolons', async () => {
      const result = {
        ...emptyResult(),
        maximumOrderQuantities: [
          { productId: 'prod-1', maxQty: 3, ruleName: 'RuleA' },
          { productId: 'prod-2', maxQty: 1, ruleName: 'RuleB' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceCartRules(baseContext)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await service.enforceCartRules(baseContext);
      } catch (e) {
        expect((e as BadRequestException).message).toContain(';');
      }
    });

    it('should prioritize nonPurchasable over maximumOrderQuantities', async () => {
      const result = {
        ...emptyResult(),
        nonPurchasable: [{ productId: 'prod-1', message: 'Not available' }],
        maximumOrderQuantities: [
          { productId: 'prod-1', maxQty: 3, ruleName: 'MaxRule' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceCartRules(baseContext)).rejects.toThrow(
        BadRequestException,
      );
      // Should throw for nonPurchasable first (it's checked before max quantities)
      try {
        await service.enforceCartRules(baseContext);
      } catch (e) {
        expect((e as BadRequestException).message).toContain('Not available');
      }
    });

    it('should pass when there are no violations', async () => {
      rulesEngine.evaluateRules.mockResolvedValue(emptyResult());

      const result = await service.enforceCartRules(baseContext);
      expect(result).toEqual(emptyResult());
    });

    it('should pass and return result with discounts when no cart violations', async () => {
      const result: RuleEvaluationResult = {
        ...emptyResult(),
        productDiscounts: [
          { productId: 'prod-1', discountAmount: 10, discountPercent: 10, ruleName: 'Discount' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      const returned = await service.enforceCartRules(baseContext);
      expect(returned.productDiscounts).toHaveLength(1);
    });
  });

  // ── enforceOrderRules ────────────────────────────────────────────────

  describe('enforceOrderRules', () => {
    it('should throw ForbiddenException for checkout restriction', async () => {
      const result = {
        ...emptyResult(),
        checkoutRestrictions: [
          { restricted: true, message: 'Role not allowed', ruleName: 'BlockRule' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        'Role not allowed',
      );
    });

    it('should use default message when checkoutRestriction has no message', async () => {
      const result = {
        ...emptyResult(),
        checkoutRestrictions: [
          { restricted: true, message: undefined, ruleName: 'BlockRule' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        'Checkout restricted by rule: BlockRule',
      );
    });

    it('should throw BadRequestException for minimum order quantity violation', async () => {
      const result = {
        ...emptyResult(),
        minimumOrderQuantities: [
          { productId: 'prod-1', minQty: 10, ruleName: 'MinQtyRule' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        'Product prod-1 requires minimum quantity of 10 (rule: MinQtyRule)',
      );
    });

    it('should throw BadRequestException for maximum order quantity violation', async () => {
      const result = {
        ...emptyResult(),
        maximumOrderQuantities: [
          { productId: 'prod-1', maxQty: 3, ruleName: 'MaxQtyRule' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        'Product prod-1 exceeds maximum quantity of 3 (rule: MaxQtyRule)',
      );
    });

    it('should throw BadRequestException for non-purchasable product', async () => {
      const result = {
        ...emptyResult(),
        nonPurchasable: [
          { productId: 'prod-1', message: 'Product not available for purchase' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        'Product not available for purchase',
      );
    });

    it('should prioritize checkoutRestrictions over other violations', async () => {
      const result = {
        ...emptyResult(),
        checkoutRestrictions: [
          { restricted: true, message: 'Blocked', ruleName: 'BlockRule' },
        ],
        nonPurchasable: [
          { productId: 'prod-1', message: 'Not available' },
        ],
        minimumOrderQuantities: [
          { productId: 'prod-2', minQty: 10, ruleName: 'MinRule' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      // checkoutRestrictions is checked first
      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should prioritize nonPurchasable over min/max quantities', async () => {
      const result = {
        ...emptyResult(),
        nonPurchasable: [
          { productId: 'prod-1', message: 'Not available' },
        ],
        minimumOrderQuantities: [
          { productId: 'prod-2', minQty: 10, ruleName: 'MinRule' },
        ],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      // nonPurchasable is checked before minimumOrderQuantities
      await expect(service.enforceOrderRules(baseContext)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await service.enforceOrderRules(baseContext);
      } catch (e) {
        expect((e as BadRequestException).message).toContain('Not available');
      }
    });

    it('should pass when there are no violations', async () => {
      rulesEngine.evaluateRules.mockResolvedValue(emptyResult());

      const result = await service.enforceOrderRules(baseContext);
      expect(result).toEqual(emptyResult());
    });

    it('should pass and return result with valid data when no order violations', async () => {
      const result: RuleEvaluationResult = {
        ...emptyResult(),
        cartDiscount: { discountAmount: 50, discountPercent: 5, ruleName: 'CartOff' },
        shipping: { shippingType: 'FLAT_RATE', cost: 10, ruleName: 'ShipRule' },
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      const returned = await service.enforceOrderRules(baseContext);
      expect(returned.cartDiscount).not.toBeNull();
      expect(returned.shipping).not.toBeNull();
    });
  });

  // ── checkProductAccess ───────────────────────────────────────────────

  describe('checkProductAccess', () => {
    it('should return nonPurchasableIds and hiddenProductIds without throwing', async () => {
      const result: RuleEvaluationResult = {
        ...emptyResult(),
        nonPurchasable: [
          { productId: 'prod-1', message: 'Not available' },
          { productId: 'prod-2', message: 'Restricted' },
        ],
        hiddenProducts: ['prod-3', 'prod-4'],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      const access = await service.checkProductAccess(baseContext);
      expect(access).toEqual({
        nonPurchasableIds: ['prod-1', 'prod-2'],
        hiddenProductIds: ['prod-3', 'prod-4'],
      });
    });

    it('should return empty arrays when no violations', async () => {
      rulesEngine.evaluateRules.mockResolvedValue(emptyResult());

      const access = await service.checkProductAccess(baseContext);
      expect(access).toEqual({
        nonPurchasableIds: [],
        hiddenProductIds: [],
      });
    });

    it('should not throw even when there are non-purchasable products', async () => {
      const result: RuleEvaluationResult = {
        ...emptyResult(),
        nonPurchasable: [{ productId: 'prod-1', message: 'Not available' }],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      // Unlike enforceCartRules/enforceOrderRules, this should NOT throw
      const access = await service.checkProductAccess(baseContext);
      expect(access.nonPurchasableIds).toEqual(['prod-1']);
    });

    it('should correctly extract product IDs from nonPurchasable entries without messages', async () => {
      const result: RuleEvaluationResult = {
        ...emptyResult(),
        nonPurchasable: [{ productId: 'prod-5' }],
      };
      rulesEngine.evaluateRules.mockResolvedValue(result);

      const access = await service.checkProductAccess(baseContext);
      expect(access.nonPurchasableIds).toEqual(['prod-5']);
    });
  });
});