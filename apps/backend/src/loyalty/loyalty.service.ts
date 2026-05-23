import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) {}

  async getAccount(userId: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!account) {
      return this.prisma.loyaltyAccount.create({
        data: { userId },
        include: { transactions: true },
      });
    }
    return account;
  }

  async earnPoints(userId: string, points: number, description: string, amount?: number) {
    const account = await this.getAccount(userId);
    const newPoints = account.points + points;
    const newLifetime = account.lifetimePoints + points;
    const tier = this.calculateTier(newLifetime);

    await this.prisma.$transaction([
      this.prisma.loyaltyTransaction.create({
        data: { accountId: account.id, type: 'EARN', points, amount: amount ?? null, description },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: newPoints, lifetimePoints: newLifetime, tier },
      }),
    ]);

    return this.getAccount(userId);
  }

  async redeemPoints(userId: string, points: number, description: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({ where: { userId } });
    if (!account) throw new NotFoundException('Loyalty account not found');
    if (account.points < points) throw new NotFoundException('Insufficient points');

    await this.prisma.$transaction([
      this.prisma.loyaltyTransaction.create({
        data: { accountId: account.id, type: 'REDEEM', points: -points, description },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: account.points - points },
      }),
    ]);

    return this.getAccount(userId);
  }

  async addCashback(userId: string, amount: number, description: string) {
    const account = await this.getAccount(userId);
    await this.prisma.$transaction([
      this.prisma.loyaltyTransaction.create({
        data: { accountId: account.id, type: 'CASHBACK', points: 0, amount, description },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { walletBalance: { increment: amount } },
      }),
    ]);
    return this.getAccount(userId);
  }

  async getLeaderboard(limit = 20) {
    return this.prisma.loyaltyAccount.findMany({
      orderBy: { lifetimePoints: 'desc' },
      take: limit,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
  }

  private calculateTier(lifetimePoints: number): string {
    if (lifetimePoints >= 10000) return 'platinum';
    if (lifetimePoints >= 5000) return 'gold';
    if (lifetimePoints >= 1000) return 'silver';
    return 'bronze';
  }
}
