import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!wallet) throw new NotFoundException('Wallet not found for this user');
    return wallet;
  }

  async findAll() {
    return this.prisma.wallet.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getTransactions(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    return this.prisma.walletTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCreditInfo(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const balance = Number(wallet.balance);
    const creditLimit = Number(wallet.creditLimit);
    const availableCredit = balance + creditLimit;
    const outstanding = balance < 0 ? Math.abs(balance) : 0;

    return {
      walletId: wallet.id,
      userId: wallet.userId,
      balance,
      creditLimit,
      availableCredit: Math.max(0, availableCredit),
      outstanding,
      limitReached: availableCredit <= 0,
    };
  }

  async getCreditInfoByUserId(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for this user');

    const balance = Number(wallet.balance);
    const creditLimit = Number(wallet.creditLimit);
    const availableCredit = balance + creditLimit;
    const outstanding = balance < 0 ? Math.abs(balance) : 0;

    return {
      walletId: wallet.id,
      userId: wallet.userId,
      balance,
      creditLimit,
      availableCredit: Math.max(0, availableCredit),
      outstanding,
      limitReached: availableCredit <= 0,
    };
  }

  async credit(walletId: string, amount: number, description?: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const currentBalance = Number(wallet.balance);
    const newBalance = currentBalance + amount;

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId,
          type: 'CREDIT',
          amount,
          balance: newBalance,
          description: description || 'Admin credit',
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: walletId },
        data: { balance: newBalance },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  async debit(walletId: string, amount: number, description?: string, referenceId?: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const currentBalance = Number(wallet.balance);
    const creditLimit = Number(wallet.creditLimit);
    const availableCredit = currentBalance + creditLimit;

    if (amount > availableCredit) {
      if (creditLimit > 0) {
        throw new BadRequestException(
          `Credit limit exceeded. Available credit: ${availableCredit}, requested: ${amount}`,
        );
      }
      throw new BadRequestException('Insufficient wallet balance');
    }

    const newBalance = currentBalance - amount;

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId,
          type: 'DEBIT',
          amount,
          balance: newBalance,
          description: description || 'Admin debit',
          referenceId: referenceId || null,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: walletId },
        data: { balance: newBalance },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  async setCreditLimit(walletId: string, creditLimit: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    // Validate that the new limit doesn't make current balance invalid
    const currentBalance = Number(wallet.balance);
    if (currentBalance < 0 && Math.abs(currentBalance) > creditLimit) {
      throw new BadRequestException(
        `Cannot set credit limit to ${creditLimit}. Current outstanding balance is ${Math.abs(currentBalance)}, which exceeds the new limit. User must pay ₹${Math.abs(currentBalance) - creditLimit} first.`,
      );
    }

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { creditLimit },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}