import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyEarningService } from '../loyalty/loyalty-earning.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private loyaltyEarningService: LoyaltyEarningService,
  ) {}

  async findAll(productId?: string, userId?: string) {
    const where: any = {};
    if (productId) where.productId = productId;
    if (userId) where.userId = userId;

    return this.prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        product: { select: { id: true, title: true, handle: true } },
      },
    });
  }

  async findById(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        product: { select: { id: true, title: true, handle: true } },
      },
    });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  async create(userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.review.findFirst({
      where: { productId: dto.productId, userId },
    });
    if (existing) throw new BadRequestException('You have already reviewed this product');

    const review = await this.prisma.review.create({
      data: {
        productId: dto.productId,
        userId,
        rating: dto.rating,
        title: dto.title || null,
        body: dto.body || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        product: { select: { id: true, title: true, handle: true } },
      },
    });

    await this.updateProductRating(dto.productId);

    // Award loyalty points for review
    try {
      await this.loyaltyEarningService.evaluateAndAward(userId, 'REVIEW_SUBMITTED', {
        productId: dto.productId,
        rating: dto.rating,
      });
    } catch (err) {
      this.logger.error(`Failed to award loyalty review bonus for user ${userId}: ${err.message}`);
    }

    return review;
  }

  async remove(id: string, userId: string, isAdmin: boolean) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (!isAdmin && review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.prisma.review.delete({ where: { id } });
    await this.updateProductRating(review.productId);

    return { success: true };
  }

  private async updateProductRating(productId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        rating: stats._avg.rating || 0,
        reviewCount: stats._count.id || 0,
      },
    });
  }
}
