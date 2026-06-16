import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { EmailService } from '../notifications/email.service';
import { LoyaltyEarningService } from '../loyalty/loyalty-earning.service';
import { RulesEnforcementService } from '../rules/rules-enforcement.service';

describe('OrdersService — Rules Enforcement', () => {
  let service: OrdersService;
  let prisma: {
    cart: { findUnique: jest.Mock };
    cartItem: { deleteMany: jest.Mock };
    user: { findUnique: jest.Mock };
    product: { findUnique: jest.Mock };
    order: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    coupon: { findFirst: jest.Mock; update: jest.Mock };
  };
  let inventoryService: { reserveStock: jest.Mock; releaseStock: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendOrderConfirmation: jest.Mock };
  let loyaltyEarningService: { evaluateAndAward: jest.Mock };
  let rulesEnforcement: { enforceOrderRules: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'buyer@test.com',
    effectiveRole: 'BUYER',
    role: 'BUYER',
  };

  const mockProduct = {
    id: 'product-1',
    title: 'Test Product',
    categoryId: 'cat-1',
    status: 'PUBLISHED',
    moq: 1,
    manageInventory: false,
    inventoryQuantity: 100,
    reservedQuantity: 0,
    unitPrice: 100,
  };

  const mockCart = {
    id: 'cart-1',
    userId: 'user-1',
    items: [
      {
        id: 'item-1',
        productId: 'product-1',
        quantity: 5,
        unitPrice: 100,
        metadata: null,
        product: { id: 'product-1', categoryId: 'cat-1', title: 'Test Product' },
      },
    ],
  };

  const mockOrder = {
    id: 'order-1',
    orderNumber: 'ORD-12345678',
    userId: 'user-1',
    totalAmount: 500,
    currency: 'INR',
    status: 'PENDING',
    items: [
      { id: 'oi-1', productId: 'product-1', quantity: 5, unitPrice: 100, totalPrice: 500, product: { id: 'product-1', title: 'Test Product', thumbnail: null } },
    ],
    user: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'buyer@test.com' },
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
      cart: { findUnique: jest.fn() },
      cartItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      coupon: { findFirst: jest.fn(), update: jest.fn() },
    };

    inventoryService = {
      reserveStock: jest.fn().mockResolvedValue(undefined),
      releaseStock: jest.fn().mockResolvedValue(undefined),
    };

    emailService = {
      isConfigured: jest.fn().mockReturnValue(false),
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
    };

    loyaltyEarningService = {
      evaluateAndAward: jest.fn().mockResolvedValue(undefined),
    };

    rulesEnforcement = {
      enforceOrderRules: jest.fn().mockResolvedValue(emptyEvaluationResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryService, useValue: inventoryService },
        { provide: EmailService, useValue: emailService },
        { provide: LoyaltyEarningService, useValue: loyaltyEarningService },
        { provide: RulesEnforcementService, useValue: rulesEnforcement },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── createFromCart ───────────────────────────────────────────────────

  describe('createFromCart', () => {
    const orderData = {
      shippingAddress: { line1: '123 Main St', city: 'Mumbai' },
      billingAddress: { line1: '123 Main St', city: 'Mumbai' },
      notes: 'Test order',
    };

    it('should block order on checkout restriction (ForbiddenException)', async () => {
      prisma.cart.findUnique.mockResolvedValueOnce(mockCart);
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);

      rulesEnforcement.enforceOrderRules.mockRejectedValue(
        new ForbiddenException('Checkout restricted by rule: RegionBlock'),
      );

      await expect(
        service.createFromCart('user-1', 'cart-1', orderData),
      ).rejects.toThrow('Checkout restricted');

      // Verify the order was never created
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should block order on minimum order quantity violation (BadRequestException)', async () => {
      prisma.cart.findUnique.mockResolvedValueOnce(mockCart);
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);

      rulesEnforcement.enforceOrderRules.mockRejectedValue(
        new BadRequestException('Product product-1 requires minimum quantity of 50 (rule: MinQtyRule)'),
      );

      await expect(
        service.createFromCart('user-1', 'cart-1', orderData),
      ).rejects.toThrow('requires minimum quantity');

      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should block order on non-purchasable product (BadRequestException)', async () => {
      prisma.cart.findUnique.mockResolvedValueOnce(mockCart);
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);

      rulesEnforcement.enforceOrderRules.mockRejectedValue(
        new BadRequestException('Product product-1 is not available for purchase'),
      );

      await expect(
        service.createFromCart('user-1', 'cart-1', orderData),
      ).rejects.toThrow('not available for purchase');

      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should allow order when no rule violations exist', async () => {
      prisma.cart.findUnique.mockResolvedValueOnce(mockCart);
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      rulesEnforcement.enforceOrderRules.mockResolvedValueOnce(emptyEvaluationResult);
      prisma.order.create.mockResolvedValueOnce(mockOrder);

      const result = await service.createFromCart('user-1', 'cart-1', orderData);

      // Verify enforceOrderRules was called with correct context
      expect(rulesEnforcement.enforceOrderRules).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          userRole: 'BUYER',
          cartItems: expect.arrayContaining([
            expect.objectContaining({
              productId: 'product-1',
              categoryId: 'cat-1',
              quantity: 5,
              unitPrice: 100,
            }),
          ]),
          subtotal: 500,
        }),
      );

      // Verify the order was created
      expect(prisma.order.create).toHaveBeenCalled();
      expect(result).toEqual(mockOrder);
    });

    it('should resolve userRole from effectiveRole/roleRel/role chain', async () => {
      const userWithRoleRel = {
        id: 'user-2',
        email: 'vendor@test.com',
        effectiveRole: null,
        roleRel: { name: 'VENDOR' },
        role: 'BUYER',
      };

      prisma.cart.findUnique.mockResolvedValueOnce(mockCart);
      prisma.user.findUnique.mockResolvedValueOnce(userWithRoleRel);
      rulesEnforcement.enforceOrderRules.mockResolvedValueOnce(emptyEvaluationResult);
      prisma.order.create.mockResolvedValueOnce(mockOrder);

      await service.createFromCart('user-2', 'cart-1', orderData);

      const enforceCall = rulesEnforcement.enforceOrderRules.mock.calls[0][0];
      // effectiveRole is null, should fall back to roleRel.name
      expect(enforceCall.userRole).toBe('VENDOR');
    });

    it('should throw BadRequestException if cart is empty', async () => {
      prisma.cart.findUnique.mockResolvedValueOnce({ ...mockCart, items: [] });

      await expect(
        service.createFromCart('user-1', 'cart-1', orderData),
      ).rejects.toThrow('Cart is empty');

      // Rules enforcement should never be called for empty cart
      expect(rulesEnforcement.enforceOrderRules).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if cart not found', async () => {
      prisma.cart.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createFromCart('user-1', 'nonexistent-cart', orderData),
      ).rejects.toThrow('Cart is empty');

      expect(rulesEnforcement.enforceOrderRules).not.toHaveBeenCalled();
    });
  });

  // ── createFromBulk ───────────────────────────────────────────────────

  describe('createFromBulk', () => {
    const bulkItems = [
      { productId: 'product-1', quantity: 10 },
    ];

    it('should block bulk order on checkout restriction (ForbiddenException)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      rulesEnforcement.enforceOrderRules.mockRejectedValue(
        new ForbiddenException('Checkout restricted by rule: RegionBlock'),
      );

      await expect(
        service.createFromBulk('user-1', bulkItems, { shippingAddress: {}, notes: 'bulk' }),
      ).rejects.toThrow('Checkout restricted');

      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should allow bulk order when no rule violations exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      rulesEnforcement.enforceOrderRules.mockResolvedValueOnce(emptyEvaluationResult);
      prisma.order.create.mockResolvedValueOnce({
        ...mockOrder,
        items: [{ id: 'oi-1', productId: 'product-1', quantity: 10, unitPrice: 100, totalPrice: 1000, product: { id: 'product-1', title: 'Test Product', thumbnail: null } }],
        totalAmount: 1000,
      });

      const result = await service.createFromBulk('user-1', bulkItems, { shippingAddress: {}, notes: 'bulk' });

      // Verify enforceOrderRules was called with correct context
      expect(rulesEnforcement.enforceOrderRules).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          userRole: 'BUYER',
          cartItems: expect.arrayContaining([
            expect.objectContaining({
              productId: 'product-1',
              quantity: 10,
              unitPrice: 100,
            }),
          ]),
        }),
      );

      expect(prisma.order.create).toHaveBeenCalled();
      expect(result.order).toBeDefined();
    });

    it('should block bulk order on maximum order quantity violation', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      rulesEnforcement.enforceOrderRules.mockRejectedValue(
        new BadRequestException('Product product-1 exceeds maximum quantity of 100 (rule: MaxQtyRule)'),
      );

      await expect(
        service.createFromBulk('user-1', [{ productId: 'product-1', quantity: 200 }], { shippingAddress: {} }),
      ).rejects.toThrow('exceeds maximum quantity');

      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createFromBulk('missing-user', bulkItems, {}),
      ).rejects.toThrow(NotFoundException);

      expect(rulesEnforcement.enforceOrderRules).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if all items are invalid', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.product.findUnique.mockResolvedValueOnce(null); // product not found

      await expect(
        service.createFromBulk('user-1', [{ productId: 'missing-product', quantity: 10 }], {}),
      ).rejects.toThrow(BadRequestException);

      expect(rulesEnforcement.enforceOrderRules).not.toHaveBeenCalled();
    });

    it('should pass subtotal to enforceOrderRules for bulk orders', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      rulesEnforcement.enforceOrderRules.mockResolvedValueOnce(emptyEvaluationResult);
      prisma.order.create.mockResolvedValueOnce(mockOrder);

      await service.createFromBulk('user-1', bulkItems, { shippingAddress: {} });

      const enforceCall = rulesEnforcement.enforceOrderRules.mock.calls[0][0];
      // 10 items * 100 unitPrice = 1000
      expect(enforceCall.subtotal).toBe(1000);
    });
  });
});