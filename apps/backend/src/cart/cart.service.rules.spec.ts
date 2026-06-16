import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { RulesEnforcementService } from '../rules/rules-enforcement.service';
import { RulesEngineService } from '../rules/rules-engine.service';

describe('CartService — Rules Enforcement', () => {
  let service: CartService;
  let prisma: {
    cart: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    cartItem: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    product: {
      findUnique: jest.Mock;
    };
  };
  let pricingService: { calculateEffectivePrice: jest.Mock };
  let rulesEnforcement: {
    enforceCartRules: jest.Mock;
  };
  let rulesEngine: {
    evaluateRules: jest.Mock;
  };

  const mockProduct = {
    id: 'product-1',
    title: 'Test Product',
    categoryId: 'cat-1',
    status: 'PUBLISHED',
    moq: 1,
    manageInventory: false,
    inventoryQuantity: 1000,
    reservedQuantity: 0,
    unitPrice: 100,
  };

  const mockCart = {
    id: 'cart-1',
    userId: 'user-1',
    sessionId: null,
    items: [],
  };

  const mockCartItem = {
    id: 'item-1',
    cartId: 'cart-1',
    productId: 'product-1',
    quantity: 2,
    unitPrice: 100,
    product: { id: 'product-1', categoryId: 'cat-1', unitPrice: 100 },
    cart: { id: 'cart-1', userId: 'user-1', sessionId: null },
  };

  const emptyEvaluationResult = {
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

  beforeEach(async () => {
    prisma = {
      cart: {
        findUnique: jest.fn().mockResolvedValue(mockCart),
        create: jest.fn().mockResolvedValue(mockCart),
      },
      cartItem: {
        findUnique: jest.fn().mockResolvedValue(mockCartItem),
        create: jest.fn().mockResolvedValue({ id: 'item-new', cartId: 'cart-1', productId: 'product-1', quantity: 1, unitPrice: 100 }),
        update: jest.fn().mockResolvedValue({ id: 'item-1', cartId: 'cart-1', productId: 'product-1', quantity: 5, unitPrice: 95 }),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue(mockProduct),
      },
    };

    pricingService = {
      calculateEffectivePrice: jest.fn().mockResolvedValue({ finalPrice: 100, originalPrice: 100, discount: 0 }),
    };

    rulesEnforcement = {
      enforceCartRules: jest.fn().mockResolvedValue(emptyEvaluationResult),
    };

    rulesEngine = {
      evaluateRules: jest.fn().mockResolvedValue(emptyEvaluationResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingService, useValue: pricingService },
        { provide: RulesEnforcementService, useValue: rulesEnforcement },
        { provide: RulesEngineService, useValue: rulesEngine },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── addItem ──────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should block adding a non-purchasable product (RulesEnforcementService throws BadRequestException)', async () => {
      rulesEnforcement.enforceCartRules.mockRejectedValue(
        new BadRequestException('Product product-1 is not available for purchase'),
      );

      await expect(
        service.addItem('product-1', 5, 'user-1', undefined, undefined, undefined, 'BUYER'),
      ).rejects.toThrow('Product product-1 is not available for purchase');
    });

    it('should block adding a product that exceeds max order quantity', async () => {
      rulesEnforcement.enforceCartRules.mockRejectedValue(
        new BadRequestException('Product product-1 exceeds maximum quantity of 10 (rule: MaxQtyRule)'),
      );

      await expect(
        service.addItem('product-1', 15, 'user-1', undefined, undefined, undefined, 'BUYER'),
      ).rejects.toThrow('exceeds maximum quantity');
    });

    it('should allow adding a product when no rule violations exist', async () => {
      // rulesEnforcement.enforceCartRules resolves successfully (no violations)
      const result = await service.addItem('product-1', 5, 'user-1', undefined, undefined, undefined, 'BUYER');

      expect(rulesEnforcement.enforceCartRules).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          userRole: 'BUYER',
          cartItems: expect.arrayContaining([
            expect.objectContaining({ productId: 'product-1', quantity: 5 }),
          ]),
        }),
      );
      // Service should proceed to create the cart item
      expect(prisma.cartItem.create).toHaveBeenCalled();
    });

    it('should pass prospective cart items context to enforceCartRules for a new item', async () => {
      const existingCartItems = [
        { id: 'item-0', productId: 'product-2', quantity: 3, unitPrice: 200, product: { categoryId: 'cat-2' } },
      ];
      const cartWithItems = { ...mockCart, items: existingCartItems };
      prisma.cart.findUnique.mockResolvedValueOnce(cartWithItems);

      await service.addItem('product-1', 5, 'user-1', undefined, undefined, undefined, 'BUYER');

      expect(rulesEnforcement.enforceCartRules).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          userRole: 'BUYER',
          cartItems: expect.arrayContaining([
            expect.objectContaining({ productId: 'product-2', quantity: 3 }),
            expect.objectContaining({ productId: 'product-1', quantity: 5 }),
          ]),
          subtotal: expect.any(Number),
        }),
      );
    });

    it('should skip rules enforcement for guest users (no userId)', async () => {
      // Guest user — no userId provided
      prisma.cart.findUnique.mockResolvedValueOnce({ ...mockCart, userId: null, sessionId: 'session-1' });

      await service.addItem('product-1', 2, undefined, 'session-1', undefined, undefined, undefined);

      // Rules enforcement should NOT be called for guest users
      expect(rulesEnforcement.enforceCartRules).not.toHaveBeenCalled();
    });
  });

  // ── updateItem ────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('should block updating quantity that exceeds max order quantity', async () => {
      const existingItem = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'product-1',
        quantity: 5,
        unitPrice: 100,
        product: mockProduct,
        cart: { id: 'cart-1', userId: 'user-1', sessionId: null },
      };

      prisma.cartItem.findUnique.mockResolvedValueOnce(existingItem);
      prisma.cart.findUnique.mockResolvedValueOnce({
        id: 'cart-1',
        userId: 'user-1',
        items: [{ id: 'item-1', productId: 'product-1', quantity: 5, unitPrice: 100, product: { id: 'product-1', categoryId: 'cat-1', unitPrice: 100 } }],
      });

      rulesEnforcement.enforceCartRules.mockRejectedValue(
        new BadRequestException('Product product-1 exceeds maximum quantity of 10 (rule: MaxQtyRule)'),
      );

      await expect(
        service.updateItem('item-1', 15, 'user-1', 'BUYER'),
      ).rejects.toThrow('exceeds maximum quantity');
    });

    it('should allow updating quantity when no rule violations exist', async () => {
      const existingItem = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'product-1',
        quantity: 2,
        unitPrice: 100,
        product: mockProduct,
        cart: { id: 'cart-1', userId: 'user-1', sessionId: null },
      };

      prisma.cartItem.findUnique.mockResolvedValueOnce(existingItem);
      prisma.cart.findUnique.mockResolvedValueOnce({
        id: 'cart-1',
        userId: 'user-1',
        items: [{ id: 'item-1', productId: 'product-1', quantity: 2, unitPrice: 100, product: { id: 'product-1', categoryId: 'cat-1', unitPrice: 100 } }],
      });

      pricingService.calculateEffectivePrice.mockResolvedValueOnce({ finalPrice: 95, originalPrice: 100, discount: 5 });

      const result = await service.updateItem('item-1', 5, 'user-1', 'BUYER');

      expect(rulesEnforcement.enforceCartRules).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          userRole: 'BUYER',
          cartItems: expect.arrayContaining([
            expect.objectContaining({ productId: 'product-1', quantity: 5 }),
          ]),
        }),
      );
      expect(prisma.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({ quantity: 5 }),
        }),
      );
    });

    it('should pass the updated quantity (not original) in the enforcement context', async () => {
      const existingItem = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'product-1',
        quantity: 2,
        unitPrice: 100,
        product: mockProduct,
        cart: { id: 'cart-1', userId: 'user-1', sessionId: null },
      };

      prisma.cartItem.findUnique.mockResolvedValueOnce(existingItem);
      prisma.cart.findUnique.mockResolvedValueOnce({
        id: 'cart-1',
        userId: 'user-1',
        items: [{ id: 'item-1', productId: 'product-1', quantity: 2, unitPrice: 100, product: { id: 'product-1', categoryId: 'cat-1', unitPrice: 100 } }],
      });

      await service.updateItem('item-1', 7, 'user-1', 'BUYER');

      const enforceCall = rulesEnforcement.enforceCartRules.mock.calls[0][0];
      const itemInContext = enforceCall.cartItems.find((c: any) => c.productId === 'product-1');
      expect(itemInContext.quantity).toBe(7);
    });
  });
});