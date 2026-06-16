import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RulesService } from './rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { RulesAuditService } from './rules-audit.service';
import { validateRuleConditionsActions } from './dto/rule-validation';

jest.mock('./dto/rule-validation');

const mockValidateRuleConditionsActions = validateRuleConditionsActions as jest.MockedFunction<
  typeof validateRuleConditionsActions
>;

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

describe('RulesService', () => {
  let service: RulesService;
  let prisma: {
    dynamicRule: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let auditService: { logChange: jest.Mock };

  beforeEach(async () => {
    prisma = {
      dynamicRule: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    auditService = { logChange: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RulesAuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<RulesService>(RulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── findAll ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all rules with no filters', async () => {
      const rules = [mockRule];
      prisma.dynamicRule.findMany.mockResolvedValue(rules);

      const result = await service.findAll();
      expect(result).toEqual(rules);
      expect(prisma.dynamicRule.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });
    });

    it('should filter by type', async () => {
      prisma.dynamicRule.findMany.mockResolvedValue([mockRule]);

      await service.findAll('PRODUCT_DISCOUNT');
      expect(prisma.dynamicRule.findMany).toHaveBeenCalledWith({
        where: { type: 'PRODUCT_DISCOUNT' },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });
    });

    it('should filter by isActive=true', async () => {
      prisma.dynamicRule.findMany.mockResolvedValue([mockRule]);

      await service.findAll(undefined, true);
      expect(prisma.dynamicRule.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });
    });

    it('should filter by isActive=false', async () => {
      prisma.dynamicRule.findMany.mockResolvedValue([]);

      await service.findAll(undefined, false);
      expect(prisma.dynamicRule.findMany).toHaveBeenCalledWith({
        where: { isActive: false },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });
    });

    it('should filter by both type and isActive', async () => {
      prisma.dynamicRule.findMany.mockResolvedValue([mockRule]);

      await service.findAll('CART_DISCOUNT', true);
      expect(prisma.dynamicRule.findMany).toHaveBeenCalledWith({
        where: { type: 'CART_DISCOUNT', isActive: true },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });
    });
  });

  // ── findById ─────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return a rule by id', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);

      const result = await service.findById('rule-1');
      expect(result).toEqual(mockRule);
      expect(prisma.dynamicRule.findUnique).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
    });

    it('should throw NotFoundException when rule not found', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('missing-id')).rejects.toThrow(
        'Rule missing-id not found',
      );
    });
  });

  // ── create ───────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      name: 'Test Rule',
      type: 'PRODUCT_DISCOUNT' as const,
      conditions: { productIds: ['p1'], categoryIds: [] },
      actions: { discountType: 'PERCENTAGE', discountValue: 10 },
    };

    it('should create a rule and set createdBy from userId', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.create.mockResolvedValue(mockRule);

      const result = await service.create(createDto, 'user-1', 'user1@test.com');

      expect(result).toEqual(mockRule);
      expect(prisma.dynamicRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Rule',
          type: 'PRODUCT_DISCOUNT',
          conditions: createDto.conditions,
          actions: createDto.actions,
          createdBy: 'user-1',
        }),
      });
    });

    it('should set createdBy to null when no userId provided', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.create.mockResolvedValue(mockRule);

      await service.create(createDto);
      expect(prisma.dynamicRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdBy: null }),
      });
    });

    it('should validate conditions/actions before creating', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.create.mockResolvedValue(mockRule);

      await service.create(createDto, 'user-1');
      expect(mockValidateRuleConditionsActions).toHaveBeenCalledWith(
        createDto.type,
        createDto.conditions,
        createDto.actions,
      );
    });

    it('should create an audit log entry', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.create.mockResolvedValue(mockRule);

      await service.create(createDto, 'user-1', 'user1@test.com');

      expect(auditService.logChange).toHaveBeenCalledWith({
        entityType: 'DynamicRule',
        entityId: 'rule-1',
        action: 'CREATE',
        userId: 'user-1',
        userEmail: 'user1@test.com',
        changes: {
          name: 'Test Rule',
          type: 'PRODUCT_DISCOUNT',
          priority: 0,
          isActive: true,
        },
      });
    });

    it('should set defaults for priority and isActive when not provided', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.create.mockResolvedValue(mockRule);

      await service.create(createDto);
      expect(prisma.dynamicRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 0,
          isActive: true,
        }),
      });
    });

    it('should pass through startDate and endDate when provided', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.create.mockResolvedValue(mockRule);

      const dtoWithDates = {
        ...createDto,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
      };

      await service.create(dtoWithDates);
      expect(prisma.dynamicRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startDate: new Date('2025-01-01T00:00:00Z'),
          endDate: new Date('2025-12-31T23:59:59Z'),
        }),
      });
    });
  });

  // ── update ───────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update a rule and set updatedBy', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);

      const updatedRule = { ...mockRule, name: 'Updated Rule', updatedBy: 'user-1' };
      prisma.dynamicRule.update.mockResolvedValue(updatedRule);

      const result = await service.update('rule-1', { name: 'Updated Rule' }, 'user-1');

      expect(result).toEqual(updatedRule);
      expect(prisma.dynamicRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: expect.objectContaining({
          name: 'Updated Rule',
          updatedBy: 'user-1',
        }),
      });
    });

    it('should set updatedBy to null when no userId provided', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);
      prisma.dynamicRule.update.mockResolvedValue(mockRule);

      await service.update('rule-1', { name: 'New Name' });
      expect(prisma.dynamicRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: expect.objectContaining({ updatedBy: null }),
      });
    });

    it('should validate conditions/actions using effective type', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);
      prisma.dynamicRule.update.mockResolvedValue(mockRule);

      await service.update('rule-1', { conditions: { productIds: ['p2'] } });
      expect(mockValidateRuleConditionsActions).toHaveBeenCalledWith(
        'PRODUCT_DISCOUNT', // falls back to existing.type since dto.type not provided
        { productIds: ['p2'] },
        mockRule.actions, // falls back to existing.actions since dto.actions not provided
      );
    });

    it('should create an audit log with diff of changed fields', async () => {
      mockValidateRuleConditionsActions.mockResolvedValue(undefined);
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);

      const updatedRule = { ...mockRule, name: 'Updated Rule', priority: 5 };
      prisma.dynamicRule.update.mockResolvedValue(updatedRule);

      await service.update('rule-1', { name: 'Updated Rule', priority: 5 }, 'user-1', 'u@t.com');

      expect(auditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'DynamicRule',
          entityId: 'rule-1',
          action: 'UPDATE',
          userId: 'user-1',
          userEmail: 'u@t.com',
        }),
      );

      // Verify the changes object contains from/to diffs
      const logCall = auditService.logChange.mock.calls[0][0];
      expect(logCall.changes).toBeDefined();
    });

    it('should throw NotFoundException when updating a non-existent rule', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete a rule and return success', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);
      prisma.dynamicRule.delete.mockResolvedValue(mockRule);

      const result = await service.remove('rule-1', 'user-1', 'u@t.com');
      expect(result).toEqual({ success: true });
      expect(prisma.dynamicRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
    });

    it('should create an audit log before deletion', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);
      prisma.dynamicRule.delete.mockResolvedValue(mockRule);

      await service.remove('rule-1', 'user-1', 'u@t.com');

      expect(auditService.logChange).toHaveBeenCalledWith({
        entityType: 'DynamicRule',
        entityId: 'rule-1',
        action: 'DELETE',
        userId: 'user-1',
        userEmail: 'u@t.com',
        changes: { name: 'Test Rule', type: 'PRODUCT_DISCOUNT' },
      });
    });

    it('should throw NotFoundException when deleting a non-existent rule', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should log audit before performing the delete', async () => {
      const order: string[] = [];
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);
      prisma.dynamicRule.delete.mockImplementation(() => {
        order.push('delete');
        return Promise.resolve(mockRule);
      });
      auditService.logChange.mockImplementation(() => {
        order.push('audit');
        return Promise.resolve(undefined);
      });

      await service.remove('rule-1');
      expect(order).toEqual(['audit', 'delete']);
    });
  });

  // ── toggleActive ──────────────────────────────────────────────────────

  describe('toggleActive', () => {
    it('should flip isActive from true to false', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule); // isActive: true
      const updatedRule = { ...mockRule, isActive: false, updatedBy: 'user-1' };
      prisma.dynamicRule.update.mockResolvedValue(updatedRule);

      const result = await service.toggleActive('rule-1', 'user-1');
      expect(result).toEqual(updatedRule);
      expect(prisma.dynamicRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: { isActive: false, updatedBy: 'user-1' },
      });
    });

    it('should flip isActive from false to true', async () => {
      const inactiveRule = { ...mockRule, isActive: false };
      prisma.dynamicRule.findUnique.mockResolvedValue(inactiveRule);
      const updatedRule = { ...mockRule, isActive: true, updatedBy: 'user-1' };
      prisma.dynamicRule.update.mockResolvedValue(updatedRule);

      const result = await service.toggleActive('rule-1', 'user-1');
      expect(result).toEqual(updatedRule);
      expect(prisma.dynamicRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: { isActive: true, updatedBy: 'user-1' },
      });
    });

    it('should set updatedBy to null when no userId provided', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);
      prisma.dynamicRule.update.mockResolvedValue({ ...mockRule, isActive: false });

      await service.toggleActive('rule-1');
      expect(prisma.dynamicRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: { isActive: false, updatedBy: null },
      });
    });

    it('should create an audit log for the toggle', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(mockRule);
      const updatedRule = { ...mockRule, isActive: false, updatedBy: 'user-1' };
      prisma.dynamicRule.update.mockResolvedValue(updatedRule);

      await service.toggleActive('rule-1', 'user-1', 'u@t.com');

      expect(auditService.logChange).toHaveBeenCalledWith({
        entityType: 'DynamicRule',
        entityId: 'rule-1',
        action: 'TOGGLE',
        userId: 'user-1',
        userEmail: 'u@t.com',
        changes: { isActive: { from: true, to: false } },
      });
    });

    it('should throw NotFoundException when toggling a non-existent rule', async () => {
      prisma.dynamicRule.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});