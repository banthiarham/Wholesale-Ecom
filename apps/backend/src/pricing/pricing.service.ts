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

    // 2. Contract price
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

    // Start with best price among base/tier/contract
    let currentPrice = contractPrice !== null
      ? Math.min(tierPrice, contractPrice)
      : tierPrice;

    // 3. Seasonal discount
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
      contractPrice,
      seasonalDiscount,
      finalPrice,
      discountAmount,
      discountPercent,
      appliedDiscounts,
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
}
