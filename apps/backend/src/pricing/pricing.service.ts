import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  async calculateEffectivePrice(
    productId: string,
    quantity: number,
    userId?: string,
  ): Promise<{
    basePrice: number;
    tierPrice: number;
    rolePrice: number | null;
    appliedRoleName: string | null;
    roleTiers: { minQty: number; price: number }[];
    contractPrice: number | null;
    seasonalDiscount: number;
    finalPrice: number;
    discountAmount: number;
    discountPercent: number;
    appliedDiscounts: string[];
    appliedRule: 'contract' | 'role' | 'tier' | 'discount' | 'base';
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        tierPrices: { orderBy: { minQty: 'asc' } },
        category: true,
      },
    });

    if (!product) throw new Error('Product not found');

    const basePrice = Number(product.unitPrice);

    // Product Tier Pricing (priority 3) — computed regardless of what wins, so the
    // UI can still show "bulk pricing available" even when a higher-priority rule applies.
    const tier = product.tierPrices.find(
      (tp) => quantity >= tp.minQty && (!tp.maxQty || quantity <= tp.maxQty),
    );
    const tierPrice = tier ? Number(tier.price) : basePrice;

    // Role Custom Price (priority 1, after contract) — Admin → Role-Based Pricing.
    // A role can have multiple quantity tiers per product (e.g. qty 1 -> ₹100, qty 10 ->
    // ₹90, qty 50 -> ₹80); the applicable tier is the one with the highest minQty that
    // doesn't exceed the requested quantity — same "best applicable slab" rule as Product
    // Tier Pricing above, just scoped to this buyer's role.
    let rolePrice: number | null = null;
    let appliedRoleName: string | null = null;
    let roleTiers: { minQty: number; price: number }[] = [];
    let loggedInRole: string | null = null;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roleRel: true },
      });
      if (user?.roleId) {
        loggedInRole = user.roleRel?.label || user.roleRel?.name || null;
        const roleTierRecords = await this.prisma.rolePrice.findMany({
          where: { productId, roleId: user.roleId, isActive: true },
          orderBy: { minQty: 'asc' },
        });
        roleTiers = roleTierRecords.map((rt) => ({ minQty: rt.minQty, price: Number(rt.price) }));
        const applicableRoleTier = [...roleTierRecords]
          .sort((a, b) => b.minQty - a.minQty)
          .find((rt) => quantity >= rt.minQty);
        if (applicableRoleTier) {
          rolePrice = Number(applicableRoleTier.price);
          appliedRoleName = user.roleRel?.label || user.roleRel?.name || null;
        }
      }
    }

    // Contract Price (priority 0 — a per-user negotiated price, more specific than role pricing)
    let contractPrice: number | null = null;
    if (userId) {
      const contract = await this.prisma.contractPrice.findFirst({
        where: {
          productId,
          userId,
          isActive: true,
          OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
          minQty: { lte: quantity },
        },
        orderBy: { price: 'asc' },
      });
      if (contract) contractPrice = Number(contract.price);
    }

    // Product Discount (priority 4) — seasonal/product discount off the base price.
    // Only ever used as a fallback price source, never stacked on top of a higher-priority rule.
    const now = new Date();
    const seasonal = await this.prisma.seasonalDiscount.findFirst({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        minQty: { lte: quantity },
        OR: [
          { productId },
          { categoryId: product.categoryId || undefined },
        ],
      },
      orderBy: { value: 'desc' },
    });
    let discountedBasePrice: number | null = null;
    if (seasonal) {
      const discountValue =
        seasonal.type === 'PERCENTAGE'
          ? basePrice * (Number(seasonal.value) / 100)
          : Number(seasonal.value);
      discountedBasePrice = Math.max(0, basePrice - discountValue);
    }

    // Strict priority waterfall — the first applicable rule wins outright; nothing stacks:
    // Contract Price > Role Custom Price (now itself quantity-tiered) > Product Tier Pricing > Product Discount > Base Price
    let finalPrice: number;
    let appliedRule: 'contract' | 'role' | 'tier' | 'discount' | 'base';
    if (contractPrice !== null) {
      finalPrice = contractPrice;
      appliedRule = 'contract';
    } else if (rolePrice !== null) {
      finalPrice = rolePrice;
      appliedRule = 'role';
    } else if (tier) {
      finalPrice = tierPrice;
      appliedRule = 'tier';
    } else if (discountedBasePrice !== null) {
      finalPrice = discountedBasePrice;
      appliedRule = 'discount';
    } else {
      finalPrice = basePrice;
      appliedRule = 'base';
    }

    const appliedDiscounts: string[] = [];
    if (appliedRule === 'contract') {
      appliedDiscounts.push(`Contract: ₹${finalPrice.toLocaleString('en-IN')}`);
    }
    if (appliedRule === 'role') {
      appliedDiscounts.push(`Role (${appliedRoleName}): ₹${finalPrice.toLocaleString('en-IN')}`);
    }
    if (appliedRule === 'discount' && seasonal) {
      appliedDiscounts.push(`Seasonal: ${seasonal.name}`);
    }

    const seasonalDiscount = appliedRule === 'discount' ? basePrice - finalPrice : 0;
    const discountAmount = basePrice - finalPrice;
    const discountPercent = basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;

    // eslint-disable-next-line no-console
    console.log('[PricingEngine] calculateEffectivePrice', {
      productId,
      quantity,
      loggedInRole,
      basePrice,
      rolePrice,
      tierPrice,
      contractPrice,
      productDiscountPrice: discountedBasePrice,
      finalPrice,
      appliedRule,
    });

    return {
      basePrice,
      tierPrice,
      rolePrice,
      appliedRoleName,
      roleTiers,
      contractPrice,
      seasonalDiscount,
      finalPrice,
      discountAmount,
      discountPercent,
      appliedDiscounts,
      appliedRule,
    };
  }

  /**
   * Calculate effective price for a specific role (admin preview).
   * Similar to calculateEffectivePrice but uses roleId directly instead of userId.
   */
  async calculatePriceForRole(
    productId: string,
    quantity: number,
    roleId: string,
  ): Promise<{
    basePrice: number;
    tierPrice: number;
    rolePrice: number | null;
    appliedRoleName: string | null;
    roleTiers: { minQty: number; price: number }[];
    seasonalDiscount: number;
    finalPrice: number;
    discountAmount: number;
    discountPercent: number;
    appliedRule: 'role' | 'tier' | 'discount' | 'base';
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        tierPrices: { orderBy: { minQty: 'asc' } },
        category: true,
      },
    });

    if (!product) throw new Error('Product not found');

    const basePrice = Number(product.unitPrice);

    // Product Tier Pricing
    const tier = product.tierPrices.find(
      (tp) => quantity >= tp.minQty && (!tp.maxQty || quantity <= tp.maxQty),
    );
    const tierPrice = tier ? Number(tier.price) : basePrice;

    // Role Custom Price — same multi-tier "best applicable slab" resolution as
    // calculateEffectivePrice, just against an explicit roleId instead of a userId.
    let rolePrice: number | null = null;
    let appliedRoleName: string | null = null;
    let roleTiers: { minQty: number; price: number }[] = [];
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    const roleTierRecords = await this.prisma.rolePrice.findMany({
      where: { productId, roleId, isActive: true },
      orderBy: { minQty: 'asc' },
    });
    roleTiers = roleTierRecords.map((rt) => ({ minQty: rt.minQty, price: Number(rt.price) }));
    const applicableRoleTier = [...roleTierRecords]
      .sort((a, b) => b.minQty - a.minQty)
      .find((rt) => quantity >= rt.minQty);
    if (applicableRoleTier) {
      rolePrice = Number(applicableRoleTier.price);
      appliedRoleName = role?.label || role?.name || null;
    }

    // Product Discount — fallback price source only, same waterfall as calculateEffectivePrice.
    const now = new Date();
    const seasonal = await this.prisma.seasonalDiscount.findFirst({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        minQty: { lte: quantity },
        OR: [
          { productId },
          { categoryId: product.categoryId || undefined },
        ],
      },
      orderBy: { value: 'desc' },
    });
    let discountedBasePrice: number | null = null;
    if (seasonal) {
      const discountValue =
        seasonal.type === 'PERCENTAGE'
          ? basePrice * (Number(seasonal.value) / 100)
          : Number(seasonal.value);
      discountedBasePrice = Math.max(0, basePrice - discountValue);
    }

    // Priority: Role Custom Price > Product Tier Pricing > Product Discount > Base Price
    let finalPrice: number;
    let appliedRule: 'role' | 'tier' | 'discount' | 'base';
    if (rolePrice !== null) {
      finalPrice = rolePrice;
      appliedRule = 'role';
    } else if (tier) {
      finalPrice = tierPrice;
      appliedRule = 'tier';
    } else if (discountedBasePrice !== null) {
      finalPrice = discountedBasePrice;
      appliedRule = 'discount';
    } else {
      finalPrice = basePrice;
      appliedRule = 'base';
    }

    const seasonalDiscount = appliedRule === 'discount' ? basePrice - finalPrice : 0;
    const discountAmount = basePrice - finalPrice;
    const discountPercent = basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;

    // eslint-disable-next-line no-console
    console.log('[PricingEngine] calculatePriceForRole (admin preview)', {
      productId,
      quantity,
      roleId,
      appliedRoleName,
      basePrice,
      rolePrice,
      tierPrice,
      productDiscountPrice: discountedBasePrice,
      finalPrice,
      appliedRule,
    });

    return {
      basePrice,
      tierPrice,
      rolePrice,
      appliedRoleName,
      roleTiers,
      seasonalDiscount,
      finalPrice,
      discountAmount,
      discountPercent,
      appliedRule,
    };
  }

  async applyCoupon(
    code: string,
    subtotal: number,
  ): Promise<{
    valid: boolean;
    discountAmount: number;
    message: string;
    coupon?: any;
  }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return { valid: false, discountAmount: 0, message: 'Invalid coupon code' };
    }

    if (!coupon.isActive) {
      return { valid: false, discountAmount: 0, message: 'Coupon is inactive' };
    }

    const now = new Date();
    if (now < new Date(coupon.startDate) || now > new Date(coupon.endDate)) {
      return { valid: false, discountAmount: 0, message: 'Coupon is expired or not yet active' };
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, discountAmount: 0, message: 'Coupon usage limit reached' };
    }

    if (coupon.minOrderValue !== null && subtotal < Number(coupon.minOrderValue)) {
      return {
        valid: false,
        discountAmount: 0,
        message: `Minimum order value of ${coupon.minOrderValue} required`,
      };
    }

    let discountAmount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discountAmount = subtotal * (Number(coupon.value) / 100);
    } else {
      discountAmount = Number(coupon.value);
    }

    return { valid: true, discountAmount, message: 'Coupon applied', coupon };
  }

  async incrementCouponUsage(couponId: string) {
    return this.prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  /**
   * Get applicable payment offers for a product/category.
   * Used by product pages (display) and checkout (computation).
   */
  async getApplicablePaymentOffers(productId?: string, categoryId?: string) {
    const now = new Date();
    return this.prisma.paymentOffer.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        OR: [
          { productId: productId || undefined },
          { categoryId: categoryId || undefined },
          { productId: null, categoryId: null },
        ],
      },
      include: {
        product: { select: { id: true, title: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { value: 'desc' },
    });
  }

  /**
   * Compute the discount amount for a specific payment offer at checkout time.
   * Validates the offer is active, within date range, and meets minOrderValue.
   * Applies maxDiscount cap for PERCENTAGE offers.
   */
  async computePaymentOfferDiscount(
    offerId: string,
    subtotal: number,
  ): Promise<{ valid: boolean; discountAmount: number; message: string; offer?: any }> {
    const offer = await this.prisma.paymentOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      return { valid: false, discountAmount: 0, message: 'Offer not found' };
    }

    if (!offer.isActive) {
      return { valid: false, discountAmount: 0, message: 'Offer is inactive' };
    }

    const now = new Date();
    if (now < new Date(offer.startDate) || now > new Date(offer.endDate)) {
      return { valid: false, discountAmount: 0, message: 'Offer is expired or not yet active' };
    }

    if (offer.minOrderValue !== null && subtotal < Number(offer.minOrderValue)) {
      return {
        valid: false,
        discountAmount: 0,
        message: `Minimum order value of ₹${Number(offer.minOrderValue).toLocaleString('en-IN')} required`,
      };
    }

    let discountAmount = 0;
    if (offer.type === 'PERCENTAGE') {
      discountAmount = subtotal * (Number(offer.value) / 100);
    } else {
      discountAmount = Number(offer.value);
    }

    // Apply maxDiscount cap
    if (offer.maxDiscount !== null && discountAmount > Number(offer.maxDiscount)) {
      discountAmount = Number(offer.maxDiscount);
    }

    return { valid: true, discountAmount, message: 'Offer applied', offer };
  }
}