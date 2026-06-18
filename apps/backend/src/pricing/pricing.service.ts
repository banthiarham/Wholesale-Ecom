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
    bulkDiscountPercent: number | null;
    bulkDiscountLabel: string | null;
    contractPrice: number | null;
    seasonalDiscount: number;
    finalPrice: number;
    discountAmount: number;
    discountPercent: number;
    appliedDiscounts: string[];
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

    // 1. Tier price
    const tier = product.tierPrices.find(
      (tp) => quantity >= tp.minQty && (!tp.maxQty || quantity <= tp.maxQty),
    );
    const tierPrice = tier ? Number(tier.price) : basePrice;

    // 2. Role-based price
    let rolePrice: number | null = null;
    let appliedRoleName: string | null = null;
    let bulkDiscountPercent: number | null = null;
    let bulkDiscountLabel: string | null = null;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roleRel: true },
      });
      if (user?.roleId) {
        const rolePriceRecord = await this.prisma.rolePrice.findUnique({
          where: { productId_roleId: { productId, roleId: user.roleId } },
        });
        if (rolePriceRecord && rolePriceRecord.isActive && quantity >= rolePriceRecord.minQty) {
          // Per-product role price takes priority
          rolePrice = Number(rolePriceRecord.price);
          appliedRoleName = user.roleRel?.label || user.roleRel?.name || null;
        } else {
          // No per-product role price — check for bulk role discount
          const bulkDiscount = await this.prisma.bulkRoleDiscount.findUnique({
            where: { roleId: user.roleId },
          });
          if (bulkDiscount && bulkDiscount.isActive) {
            bulkDiscountPercent = Number(bulkDiscount.discountPercent);
            bulkDiscountLabel = bulkDiscount.label || `${user.roleRel?.label || user.roleRel?.name} Discount`;
            appliedRoleName = user.roleRel?.label || user.roleRel?.name || null;
          }
        }
      }
    }

    // 3. Contract price
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

    // Start with best price among tier/role/contract — lowest wins
    const candidates = [tierPrice];
    if (rolePrice !== null) candidates.push(rolePrice);
    if (contractPrice !== null) candidates.push(contractPrice);
    let currentPrice = Math.min(...candidates);

    // Apply bulk role discount (percentage off current best price)
    // Only applies when no per-product role price exists for this product+role
    if (bulkDiscountPercent !== null) {
      currentPrice = Math.max(0, currentPrice * (1 - bulkDiscountPercent / 100));
    }

    // 4. Seasonal discount
    let seasonalDiscount = 0;
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

    const appliedDiscounts: string[] = [];

    // Track which pricing tier was actually applied
    if (rolePrice !== null && rolePrice < tierPrice) {
      appliedDiscounts.push(`Role (${appliedRoleName}): ₹${rolePrice.toLocaleString('en-IN')}`);
    }
    if (bulkDiscountPercent !== null) {
      appliedDiscounts.push(`Bulk ${bulkDiscountLabel}: ${bulkDiscountPercent}% off`);
    }
    if (contractPrice !== null && contractPrice < tierPrice) {
      appliedDiscounts.push(`Contract: ₹${contractPrice.toLocaleString('en-IN')}`);
    }

    if (seasonal) {
      if (seasonal.type === 'PERCENTAGE') {
        seasonalDiscount = currentPrice * (Number(seasonal.value) / 100);
      } else {
        seasonalDiscount = Number(seasonal.value);
      }
      appliedDiscounts.push(`Seasonal: ${seasonal.name}`);
    }

    const finalPrice = Math.max(0, currentPrice - seasonalDiscount);
    const discountAmount = basePrice - finalPrice;
    const discountPercent = basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;

    return {
      basePrice,
      tierPrice,
      rolePrice,
      appliedRoleName,
      bulkDiscountPercent,
      bulkDiscountLabel,
      contractPrice,
      seasonalDiscount,
      finalPrice,
      discountAmount,
      discountPercent,
      appliedDiscounts,
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
    bulkDiscountPercent: number | null;
    bulkDiscountLabel: string | null;
    seasonalDiscount: number;
    finalPrice: number;
    discountAmount: number;
    discountPercent: number;
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

    // Tier price
    const tier = product.tierPrices.find(
      (tp) => quantity >= tp.minQty && (!tp.maxQty || quantity <= tp.maxQty),
    );
    const tierPrice = tier ? Number(tier.price) : basePrice;

    // Role price
    let rolePrice: number | null = null;
    let appliedRoleName: string | null = null;
    let bulkDiscountPercent: number | null = null;
    let bulkDiscountLabel: string | null = null;
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    const rolePriceRecord = await this.prisma.rolePrice.findUnique({
      where: { productId_roleId: { productId, roleId } },
    });
    if (rolePriceRecord && rolePriceRecord.isActive && quantity >= rolePriceRecord.minQty) {
      rolePrice = Number(rolePriceRecord.price);
      appliedRoleName = role?.label || role?.name || null;
    } else {
      // No per-product role price — check for bulk role discount
      const bulkDiscount = await this.prisma.bulkRoleDiscount.findUnique({
        where: { roleId },
      });
      if (bulkDiscount && bulkDiscount.isActive) {
        bulkDiscountPercent = Number(bulkDiscount.discountPercent);
        bulkDiscountLabel = bulkDiscount.label || `${role?.label || role?.name} Discount`;
        appliedRoleName = role?.label || role?.name || null;
      }
    }

    // Best price
    const candidates = [tierPrice];
    if (rolePrice !== null) candidates.push(rolePrice);
    let currentPrice = Math.min(...candidates);

    // Apply bulk role discount
    if (bulkDiscountPercent !== null) {
      currentPrice = Math.max(0, currentPrice * (1 - bulkDiscountPercent / 100));
    }

    // Seasonal discount
    let seasonalDiscount = 0;
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

    if (seasonal) {
      if (seasonal.type === 'PERCENTAGE') {
        seasonalDiscount = currentPrice * (Number(seasonal.value) / 100);
      } else {
        seasonalDiscount = Number(seasonal.value);
      }
    }

    const finalPrice = Math.max(0, currentPrice - seasonalDiscount);
    const discountAmount = basePrice - finalPrice;
    const discountPercent = basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;

    return {
      basePrice,
      tierPrice,
      rolePrice,
      appliedRoleName,
      bulkDiscountPercent,
      bulkDiscountLabel,
      seasonalDiscount,
      finalPrice,
      discountAmount,
      discountPercent,
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