import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException(`User ${userId} not found`);
      wallet = await this.prisma.wallet.create({ data: { userId } });
    }
    return wallet;
  }

  async getBalance(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    return { balance: wallet.balance, walletId: wallet.id };
  }

  async getTransactions(userId: string, limit = 50, offset = 0) {
    const wallet = await this.getOrCreateWallet(userId);
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    const total = await this.prisma.walletTransaction.count({ where: { walletId: wallet.id } });
    return { transactions, total };
  }

  async topup(userId: string, amount: number, description?: string, referenceId?: string, createdBy?: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const newBalance = Number(wallet.balance) + amount;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'TOPUP',
          amount,
          balance: newBalance,
          description: description || 'Wallet top-up',
          referenceId,
          createdBy,
        },
      });
      return { wallet: updated, transaction };
    });

    return result;
  }

  async deduct(userId: string, amount: number, description?: string, referenceId?: string, createdBy?: string) {
    const wallet = await this.getOrCreateWallet(userId);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException(`Insufficient wallet balance. Available: ${wallet.balance}, Requested: ${amount}`);
    }
    const newBalance = Number(wallet.balance) - amount;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEDUCTION',
          amount: -amount,
          balance: newBalance,
          description: description || 'Wallet deduction',
          referenceId,
          createdBy,
        },
      });
      return { wallet: updated, transaction };
    });

    return result;
  }

  async adjust(userId: string, amount: number, description?: string, createdBy?: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const currentBalance = Number(wallet.balance);
    const difference = amount - currentBalance;
    const type = difference >= 0 ? 'ADJUSTMENT' : 'ADJUSTMENT';

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: amount },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount: difference,
          balance: amount,
          description: description || `Balance adjusted from ${currentBalance} to ${amount}`,
          createdBy,
        },
      });
      return { wallet: updated, transaction };
    });

    return result;
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [wallets, total] = await Promise.all([
      this.prisma.wallet.findMany({
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.wallet.count(),
    ]);
    return { wallets, total, page, limit };
  }

  async getWalletByUserId(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { wallet, transactions };
  }
}