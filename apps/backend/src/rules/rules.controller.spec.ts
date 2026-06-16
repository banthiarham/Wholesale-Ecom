import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { RulesEngineService } from './rules-engine.service';
import { RulesAuditService } from './rules-audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

describe('RulesController', () => {
  let controller: RulesController;
  let rulesService: {
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    toggleActive: jest.Mock;
  };
  let rulesEngine: { evaluateRules: jest.Mock };
  let auditService: { getHistory: jest.Mock };
  let reflector: Reflector;

  const mockRule = {
    id: 'rule-1',
    name: 'Test Rule',
    type: 'PRODUCT_DISCOUNT',
    description: 'A test rule',
    priority: 0,
    isActive: true,
    conditions: { productIds: ['p1'], categoryIds: [] },
    actions: { discountType: 'PERCENTAGE', discountValue: 10 },
    startDate: null,
    endDate: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuditHistory = [
    {
      id: 'audit-1',
      entityType: 'DynamicRule',
      entityId: 'rule-1',
      action: 'CREATE',
      userId: 'admin-1',
      userEmail: 'admin@test.com',
      changes: { name: 'Test Rule', type: 'PRODUCT_DISCOUNT' },
      createdAt: new Date(),
    },
    {
      id: 'audit-2',
      entityType: 'DynamicRule',
      entityId: 'rule-1',
      action: 'TOGGLE',
      userId: 'admin-1',
      userEmail: 'admin@test.com',
      changes: { isActive: { from: true, to: false } },
      createdAt: new Date(),
    },
  ];

  const mockEvaluationResult = {
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
    rulesService = {
      findAll: jest.fn().mockResolvedValue([mockRule]),
      findById: jest.fn().mockResolvedValue(mockRule),
      create: jest.fn().mockResolvedValue(mockRule),
      update: jest.fn().mockResolvedValue(mockRule),
      remove: jest.fn().mockResolvedValue({ success: true }),
      toggleActive: jest.fn().mockResolvedValue({ ...mockRule, isActive: false }),
    };

    rulesEngine = {
      evaluateRules: jest.fn().mockResolvedValue(mockEvaluationResult),
    };

    auditService = {
      getHistory: jest.fn().mockResolvedValue(mockAuditHistory),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RulesController],
      providers: [
        { provide: RulesService, useValue: rulesService },
        { provide: RulesEngineService, useValue: rulesEngine },
        { provide: RulesAuditService, useValue: auditService },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RulesController>(RulesController);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Guard decoration tests ────────────────────────────────────────────

  describe('Guard and Role decorations', () => {
    it('GET /rules should require ADMIN role', () => {
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.findAll);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('GET /rules/:id should require ADMIN role', () => {
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.findById);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('GET /rules/:id/history should require ADMIN role', () => {
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.getHistory);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('POST /rules should require ADMIN role', () => {
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.create);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('PUT /rules/:id should require ADMIN role', () => {
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.update);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('DELETE /rules/:id should require ADMIN role', () => {
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.remove);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('PATCH /rules/:id/toggle should require ADMIN role', () => {
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.toggleActive);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('POST /rules/evaluate should have no role restriction (any authenticated user)', () => {
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.evaluate);
      // evaluate uses only JwtAuthGuard — no @Roles decorator
      expect(roles).toBeUndefined();
    });

    it('All admin endpoints should have JwtAuthGuard applied', () => {
      const adminMethods = [
        'findAll',
        'findById',
        'getHistory',
        'create',
        'update',
        'remove',
        'toggleActive',
      ];
      for (const method of adminMethods) {
        const guards: any[] = reflector.get('__guards__', RulesController.prototype[method]) || [];
        const guardNames = guards.map((g: any) => (typeof g === 'function' ? g.name : g.constructor?.name));
        expect(guardNames).toContain('JwtAuthGuard');
      }
    });

    it('POST /rules/evaluate should have JwtAuthGuard applied', () => {
      const guards: any[] = reflector.get('__guards__', RulesController.prototype.evaluate) || [];
      const guardNames = guards.map((g: any) => (typeof g === 'function' ? g.name : g.constructor?.name));
      expect(guardNames).toContain('JwtAuthGuard');
    });
  });

  // ── Guard rejection behavior (verified via metadata + RolesGuard logic) ──

  describe('Guard rejection behavior', () => {
    it('GET /rules requires auth: JwtAuthGuard + RolesGuard are both applied', () => {
      // Verified above: both guards are in the __guards__ metadata
      // and ADMIN role is required via @Roles(UserRole.ADMIN)
      // A request without a valid JWT token will be rejected by JwtAuthGuard,
      // and a request with a non-admin role will be rejected by RolesGuard.
      const guards: any[] = reflector.get('__guards__', RulesController.prototype.findAll) || [];
      const guardNames = guards.map((g: any) => (typeof g === 'function' ? g.name : g.constructor?.name));
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('RolesGuard');
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.findAll);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('GET /rules/:id requires auth: JwtAuthGuard + RolesGuard applied with ADMIN role', () => {
      const guards: any[] = reflector.get('__guards__', RulesController.prototype.findById) || [];
      const guardNames = guards.map((g: any) => (typeof g === 'function' ? g.name : g.constructor?.name));
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('RolesGuard');
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.findById);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('POST /rules requires admin: RolesGuard rejects non-admin users', () => {
      // Verified via metadata: ADMIN role is required
      // RolesGuard throws ForbiddenException('Insufficient permissions') when
      // the authenticated user's role is not in the required roles list.
      const roles = reflector.get(ROLES_KEY, RulesController.prototype.create);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('POST /rules/evaluate works for any authenticated user (only JwtAuthGuard, no role restriction)', async () => {
      // evaluate endpoint only uses JwtAuthGuard — no @Roles decorator
      // so any authenticated user can access it regardless of role
      const result = await controller.evaluate({ cartItems: [], subtotal: 0 }, 'buyer-1', 'BUYER');

      expect(rulesEngine.evaluateRules).toHaveBeenCalled();
      expect(result).toEqual({ result: mockEvaluationResult });
    });
  });

  // ── Controller method tests ───────────────────────────────────────────

  describe('findAll', () => {
    it('should call service.findAll with filters and return rules', async () => {
      const result = await controller.findAll('PRODUCT_DISCOUNT', 'true');

      expect(rulesService.findAll).toHaveBeenCalledWith('PRODUCT_DISCOUNT', true);
      expect(result).toEqual({ rules: [mockRule], count: 1 });
    });

    it('should call service.findAll without filters', async () => {
      const result = await controller.findAll();

      expect(rulesService.findAll).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual({ rules: [mockRule], count: 1 });
    });

    it('should pass isActive=false when query param is "false"', async () => {
      await controller.findAll(undefined, 'false');

      expect(rulesService.findAll).toHaveBeenCalledWith(undefined, false);
    });
  });

  describe('findById', () => {
    it('should call service.findById and return rule', async () => {
      const result = await controller.findById('rule-1');

      expect(rulesService.findById).toHaveBeenCalledWith('rule-1');
      expect(result).toEqual({ rule: mockRule });
    });
  });

  describe('create', () => {
    it('should pass userId and email from @CurrentUser to service.create', async () => {
      const dto = {
        name: 'New Rule',
        type: 'PRODUCT_DISCOUNT' as const,
        conditions: { productIds: ['p1'] },
        actions: { discountType: 'PERCENTAGE', discountValue: 10 },
      };
      const user = { id: 'admin-1', email: 'admin@test.com' };

      await controller.create(dto, user);

      expect(rulesService.create).toHaveBeenCalledWith(dto, 'admin-1', 'admin@test.com');
    });

    it('should handle missing user properties gracefully', async () => {
      const dto = {
        name: 'New Rule',
        type: 'CART_DISCOUNT' as const,
        conditions: {},
        actions: {},
      };

      await controller.create(dto, undefined);

      expect(rulesService.create).toHaveBeenCalledWith(dto, undefined, undefined);
    });
  });

  describe('update', () => {
    it('should pass userId and email from @CurrentUser to service.update', async () => {
      const dto = { name: 'Updated Rule' };
      const user = { id: 'admin-1', email: 'admin@test.com' };

      await controller.update('rule-1', dto, user);

      expect(rulesService.update).toHaveBeenCalledWith('rule-1', dto, 'admin-1', 'admin@test.com');
    });

    it('should pass rule id and user to service', async () => {
      const dto = { isActive: false };
      const user = { id: 'admin-2', email: 'admin2@test.com' };

      await controller.update('rule-xyz', dto, user);

      expect(rulesService.update).toHaveBeenCalledWith('rule-xyz', dto, 'admin-2', 'admin2@test.com');
    });
  });

  describe('remove', () => {
    it('should pass userId and email from @CurrentUser to service.remove', async () => {
      const user = { id: 'admin-1', email: 'admin@test.com' };

      const result = await controller.remove('rule-1', user);

      expect(rulesService.remove).toHaveBeenCalledWith('rule-1', 'admin-1', 'admin@test.com');
      expect(result).toEqual({ success: true });
    });

    it('should handle undefined user gracefully', async () => {
      await controller.remove('rule-1', undefined);

      expect(rulesService.remove).toHaveBeenCalledWith('rule-1', undefined, undefined);
    });
  });

  describe('toggleActive', () => {
    it('should pass userId and email from @CurrentUser to service.toggleActive', async () => {
      const user = { id: 'admin-1', email: 'admin@test.com' };

      const result = await controller.toggleActive('rule-1', user);

      expect(rulesService.toggleActive).toHaveBeenCalledWith('rule-1', 'admin-1', 'admin@test.com');
      expect(result).toEqual({ rule: { ...mockRule, isActive: false } });
    });
  });

  describe('getHistory', () => {
    it('should return audit history from auditService', async () => {
      const result = await controller.getHistory('rule-1');

      expect(auditService.getHistory).toHaveBeenCalledWith('rule-1');
      expect(result).toEqual({ history: mockAuditHistory });
    });

    it('should return empty array when no history exists', async () => {
      auditService.getHistory.mockResolvedValueOnce([]);

      const result = await controller.getHistory('rule-no-history');

      expect(auditService.getHistory).toHaveBeenCalledWith('rule-no-history');
      expect(result).toEqual({ history: [] });
    });
  });

  describe('evaluate', () => {
    it('should pass userId and userRole from @CurrentUser into rule context', async () => {
      const context = { cartItems: [{ productId: 'p1', quantity: 5, unitPrice: 100 }] };

      await controller.evaluate(context, 'user-1', 'BUYER');

      expect(rulesEngine.evaluateRules).toHaveBeenCalledWith({
        cartItems: [{ productId: 'p1', quantity: 5, unitPrice: 100 }],
        userId: 'user-1',
        userRole: 'BUYER',
      });
    });

    it('should work for any authenticated user (no role restriction)', async () => {
      const context = { cartItems: [], subtotal: 0 };
      const result = await controller.evaluate(context, 'buyer-1', 'BUYER');

      expect(rulesEngine.evaluateRules).toHaveBeenCalled();
      expect(result).toEqual({ result: mockEvaluationResult });
    });

    it('should spread additional context fields into the rule context', async () => {
      const context = {
        cartItems: [{ productId: 'p1', quantity: 2, unitPrice: 50 }],
        subtotal: 100,
        paymentMethod: 'UPI',
        shippingRegion: 'South',
      };

      await controller.evaluate(context, 'user-1', 'BUYER');

      expect(rulesEngine.evaluateRules).toHaveBeenCalledWith(
        expect.objectContaining({
          cartItems: context.cartItems,
          subtotal: 100,
          paymentMethod: 'UPI',
          shippingRegion: 'South',
          userId: 'user-1',
          userRole: 'BUYER',
        }),
      );
    });
  });
});