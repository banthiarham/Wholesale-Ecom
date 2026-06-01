import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DynamicRuleType } from '@prisma/client';

type LoyaltyEventType = 'ORDER_COMPLETED' | 'REVIEW_SUBMITTED' | 'USER_REGISTERED';

interface OrderItemContext {
  productId: string;
  categoryId?: string | null;
  quantity: number;
  unitPrice: number;
}

interface LoyaltyEventContext {
  orderId?: string;
  orderAmount?: number;
  orderItems?: OrderItemContext[];
  isFirstOrder?: boolean;
  productId?: string;
  rating?: number;
  referredBy?: string;
  userRole?: string;
}

interface AwardResult {
  ruleId: string;
  ruleName: string;
  points: number;
  description: string;
  type: string;
}

const LOYALTY_RULE_TYPES: Record<LoyaltyEventType, DynamicRuleType[]> = {
  ORDER_COMPLETED: [
    'LOYALTY_ORDER_EARN' as DynamicRuleType,
    'LOYALTY_CATEGORY_BONUS' as DynamicRuleType,
    'LOYALTY_FIRST_ORDER_BONUS' as DynamicRuleType,
    'LOYALTY_REFERRAL_BONUS' as DynamicRuleType,
  ],
  REVIEW_SUBMITTED: ['LOYALTY_REVIEW_BONUS' as DynamicRuleType],
  USER_REGISTERED: [],
};

@Injectable()
export class LoyaltyEarningService {
  private readonly logger = new Logger(LoyaltyEarningService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Main entry point: evaluates loyalty rules for the given event and auto-awards points.
   */
  async evaluateAndAward(
    userId: string,
    eventType: LoyaltyEventType,
    context: LoyaltyEventContext,
  ): Promise<AwardResult[]> {
    const relevantTypes = LOYALTY_RULE_TYPES[eventType];
    if (!relevantTypes || relevantTypes.length === 0) return [];

    const now = new Date();
    const rules = await this.prisma.dynamicRule.findMany({
      where: {
        isActive: true,
        type: { in: relevantTypes },
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
        ],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    if (rules.length === 0) return [];

    const results: AwardResult[] = [];

    for (const rule of rules) {
      try {
        const points = await this.calculatePoints(rule, userId, context);
        if (points > 0) {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            points,
            description: rule.description || `Earned from rule: ${rule.name}`,
            type: rule.type,
          });
        }
      } catch (err) {
        this.logger.error(`Error evaluating rule ${rule.id} (${rule.type}): ${err.message}`);
      }
    }

    // Award all points atomically
    if (results.length > 0) {
      const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
      await this.awardPoints(userId, totalPoints, results);
    }

    // Handle referral bonus for referrer if applicable
    if (eventType === 'ORDER_COMPLETED' && context.referredBy) {
      await this.handleReferralBonus(userId, context.referredBy, results);
    }

    return results;
  }

  /**
   * Calculate points for a single rule based on its type.
   */
  private async calculatePoints(
    rule: any,
    userId: string,
    context: LoyaltyEventContext,
  ): Promise<number> {
    const conditions = (rule.conditions as Record<string, any>) || {};
    const actions = (rule.actions as Record<string, any>) || {};

    switch (rule.type) {
      case 'LOYALTY_ORDER_EARN':
        return this.evaluateOrderEarn(conditions, actions, context);
      case 'LOYALTY_CATEGORY_BONUS':
        return this.evaluateCategoryBonus(conditions, actions, context);
      case 'LOYALTY_FIRST_ORDER_BONUS':
        return this.evaluateFirstOrderBonus(conditions, actions, userId, rule.id, context);
      case 'LOYALTY_REVIEW_BONUS':
        return this.evaluateReviewBonus(conditions, actions, userId, rule.id, context);
      case 'LOYALTY_REFERRAL_BONUS':
        return this.evaluateReferralBonus(conditions, actions, userId, rule.id, context);
      default:
        return 0;
    }
  }

  /**
   * LOYALTY_ORDER_EARN: Earn points per unit of currency spent.
   * actions: { pointsPerUnit, unitAmount }
   * conditions: { minOrderAmount?, roleIds? }
   */
  private evaluateOrderEarn(
    conditions: Record<string, any>,
    actions: Record<string, any>,
    context: LoyaltyEventContext,
  ): number {
    if (!context.orderAmount) return 0;

    // Check minOrderAmount condition
    if (conditions.minOrderAmount && context.orderAmount < conditions.minOrderAmount) {
      return 0;
    }

    // Check role condition
    if (conditions.roleIds?.length > 0 && context.userRole) {
      if (!conditions.roleIds.includes(context.userRole)) return 0;
    }

    const pointsPerUnit = actions.pointsPerUnit || 0;
    const unitAmount = actions.unitAmount || 1;

    if (unitAmount <= 0) return 0;
    return Math.floor(context.orderAmount / unitAmount) * pointsPerUnit;
  }

  /**
   * LOYALTY_CATEGORY_BONUS: Bonus points for purchasing from specific categories.
   * actions: { bonusPoints }
   * conditions: { categoryIds, minOrderAmount? }
   */
  private evaluateCategoryBonus(
    conditions: Record<string, any>,
    actions: Record<string, any>,
    context: LoyaltyEventContext,
  ): number {
    if (!context.orderItems?.length) return 0;

    const categoryIds = conditions.categoryIds || [];
    if (categoryIds.length === 0) return 0;

    const hasMatchingCategory = context.orderItems.some(
      (item) => item.categoryId && categoryIds.includes(item.categoryId),
    );
    if (!hasMatchingCategory) return 0;

    // Check minOrderAmount condition
    if (conditions.minOrderAmount && context.orderAmount && context.orderAmount < conditions.minOrderAmount) {
      return 0;
    }

    return actions.bonusPoints || 0;
  }

  /**
   * LOYALTY_FIRST_ORDER_BONUS: Bonus points for first order.
   * actions: { bonusPoints }
   * conditions: { roleIds? }
   */
  private async evaluateFirstOrderBonus(
    conditions: Record<string, any>,
    actions: Record<string, any>,
    userId: string,
    ruleId: string,
    context: LoyaltyEventContext,
  ): Promise<number> {
    // Only award if this is the first order
    if (!context.isFirstOrder) return 0;

    // Check role condition
    if (conditions.roleIds?.length > 0 && context.userRole) {
      if (!conditions.roleIds.includes(context.userRole)) return 0;
    }

    // Idempotency: check if already awarded this rule to this user
    const existing = await this.prisma.loyaltyTransaction.findFirst({
      where: { ruleId, type: 'AUTO_EARN', account: { userId } },
    });
    if (existing) return 0;

    return actions.bonusPoints || 0;
  }

  /**
   * LOYALTY_REVIEW_BONUS: Bonus points for writing a review.
   * actions: { bonusPoints }
   * conditions: { roleIds?, minRating? }
   */
  private async evaluateReviewBonus(
    conditions: Record<string, any>,
    actions: Record<string, any>,
    userId: string,
    ruleId: string,
    context: LoyaltyEventContext,
  ): Promise<number> {
    // Check role condition
    if (conditions.roleIds?.length > 0 && context.userRole) {
      if (!conditions.roleIds.includes(context.userRole)) return 0;
    }

    // Check minRating condition
    if (conditions.minRating && context.rating && context.rating < conditions.minRating) {
      return 0;
    }

    // Idempotency: one bonus per rule per product per user
    const existing = await this.prisma.loyaltyTransaction.findFirst({
      where: {
        ruleId,
        type: 'AUTO_EARN',
        account: { userId },
        description: { contains: context.productId || '' },
      },
    });
    if (existing) return 0;

    return actions.bonusPoints || 0;
  }

  /**
   * LOYALTY_REFERRAL_BONUS: Points for referrer when referred user completes first order.
   * actions: { referrerPoints, referredPoints? }
   * conditions: { roleIds?, minOrderAmount? }
   */
  private async evaluateReferralBonus(
    conditions: Record<string, any>,
    actions: Record<string, any>,
    userId: string,
    ruleId: string,
    context: LoyaltyEventContext,
  ): Promise<number> {
    // This evaluates for the referred user (not the referrer)
    // Referrer bonus is handled in handleReferralBonus

    // Check minOrderAmount condition
    if (conditions.minOrderAmount && context.orderAmount && context.orderAmount < conditions.minOrderAmount) {
      return 0;
    }

    const referredPoints = actions.referredPoints || 0;
    return referredPoints;
  }

  /**
   * Award referral bonus to the referrer.
   */
  private async handleReferralBonus(
    referredUserId: string,
    referralCode: string,
    existingResults: AwardResult[],
  ): Promise<void> {
    // Find the referrer by referral code
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: referralCode },
    });
    if (!referrer || referrer.id === referredUserId) return;

    // Find active LOYALTY_REFERRAL_BONUS rules
    const now = new Date();
    const rules = await this.prisma.dynamicRule.findMany({
      where: {
        isActive: true,
        type: 'LOYALTY_REFERRAL_BONUS' as DynamicRuleType,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      orderBy: [{ priority: 'asc' }],
    });

    for (const rule of rules) {
      const actions = (rule.actions as Record<string, any>) || {};
      const referrerPoints = actions.referrerPoints || 0;
      if (referrerPoints <= 0) continue;

      // Idempotency: check if referrer already got bonus for this referred user
      const existing = await this.prisma.loyaltyTransaction.findFirst({
        where: {
          ruleId: rule.id,
          type: 'AUTO_EARN',
          account: { userId: referrer.id },
          description: { contains: referredUserId },
        },
      });
      if (existing) continue;

      const results: AwardResult[] = [
        {
          ruleId: rule.id,
          ruleName: rule.name,
          points: referrerPoints,
          description: `Referral bonus: ${rule.name} (for user ${referredUserId})`,
          type: rule.type,
        },
      ];

      await this.awardPoints(referrer.id, referrerPoints, results);
    }
  }

  /**
   * Award points to a user's loyalty account atomically.
   * Creates one AUTO_EARN transaction per rule for audit trail.
   */
  private async awardPoints(
    userId: string,
    totalPoints: number,
    results: AwardResult[],
  ): Promise<void> {
    // Get or create the loyalty account
    let account = await this.prisma.loyaltyAccount.findUnique({ where: { userId } });
    if (!account) {
      account = await this.prisma.loyaltyAccount.create({ data: { userId } });
    }

    const newPoints = account.points + totalPoints;
    const newLifetime = account.lifetimePoints + totalPoints;
    const tier = this.calculateTier(newLifetime);

    // Atomic transaction: create transaction records + update account
    await this.prisma.$transaction([
      ...results.map((r) =>
        this.prisma.loyaltyTransaction.create({
          data: {
            accountId: account!.id,
            type: 'AUTO_EARN',
            points: r.points,
            description: r.description,
            ruleId: r.ruleId,
          },
        }),
      ),
      this.prisma.loyaltyAccount.update({
        where: { id: account!.id },
        data: {
          points: newPoints,
          lifetimePoints: newLifetime,
          tier,
        },
      }),
    ]);

    this.logger.log(`Awarded ${totalPoints} points to user ${userId} from ${results.length} rules`);
  }

  /**
   * Calculate loyalty tier based on lifetime points.
   */
  private calculateTier(lifetimePoints: number): string {
    if (lifetimePoints >= 10000) return 'platinum';
    if (lifetimePoints >= 5000) return 'gold';
    if (lifetimePoints >= 1000) return 'silver';
    return 'bronze';
  }

  /**
   * Generate a unique referral code for a user.
   */
  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return '';

    if (user.referralCode) return user.referralCode;

    const prefix = (user.firstName?.substring(0, 3).toUpperCase() || 'USR');
    const suffix = userId.substring(0, 6).toUpperCase();
    const code = `${prefix}${suffix}`;

    // Ensure uniqueness
    const existing = await this.prisma.user.findUnique({ where: { referralCode: code } });
    if (existing) {
      // Add random suffix for uniqueness
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const uniqueCode = `${prefix}${randomSuffix}`;
      await this.prisma.user.update({ where: { id: userId }, data: { referralCode: uniqueCode } });
      return uniqueCode;
    }

    await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
    return code;
  }

  /**
   * Get active loyalty earning rules (for user-facing display).
   */
  async getActiveEarningRules() {
    return this.prisma.dynamicRule.findMany({
      where: {
        isActive: true,
        type: {
          in: [
            'LOYALTY_ORDER_EARN' as DynamicRuleType,
            'LOYALTY_CATEGORY_BONUS' as DynamicRuleType,
            'LOYALTY_FIRST_ORDER_BONUS' as DynamicRuleType,
            'LOYALTY_REVIEW_BONUS' as DynamicRuleType,
            'LOYALTY_REFERRAL_BONUS' as DynamicRuleType,
          ],
        },
      },
      orderBy: [{ priority: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        actions: true,
        conditions: true,
        startDate: true,
        endDate: true,
      },
    });
  }
}