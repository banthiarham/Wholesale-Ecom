import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ReturnType } from '@prisma/client';

export type LedgerSource = 'ORDER' | 'PAYMENT' | 'RETURN' | 'REFUND' | 'WALLET';
export type LedgerDirection = 'DEBIT' | 'CREDIT';

export interface LedgerEntry {
  id: string;
  source: LedgerSource;
  date: Date;
  description: string;
  amount: number;
  direction: LedgerDirection;
  status: string;
  referenceId: string;
  /** Only populated for WALLET entries — the wallet's balance snapshot right after this transaction */
  runningBalance: number | null;
}

export interface LedgerFilters {
  from?: Date;
  to?: Date;
  sources?: LedgerSource[];
}

const CREDIT_WALLET_TYPES = new Set(['CREDIT', 'TOPUP', 'REFUND', 'CASHBACK']);

@Injectable()
export class LedgerService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
  ) {}

  async getLedger(userId: string, filters: LedgerFilters = {}) {
    const dateFilter =
      filters.from || filters.to
        ? { gte: filters.from, lte: filters.to }
        : undefined;

    const [orders, payments, returns, refunds, walletTransactions, creditInfo] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { payment: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: { order: { userId }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.returnRequest.findMany({
        where: { userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.refund.findMany({
        where: { payment: { order: { userId } }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { payment: { include: { order: { select: { orderNumber: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.findMany({
        where: { wallet: { userId }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        orderBy: { createdAt: 'desc' },
      }),
      this.walletService.getCreditInfoByUserId(userId).catch((err) => {
        if (err instanceof NotFoundException) {
          return { walletId: null, userId, balance: 0, creditLimit: 0, availableCredit: 0, outstanding: 0, limitReached: false };
        }
        throw err;
      }),
    ]);

    const entries: LedgerEntry[] = [];

    for (const o of orders) {
      entries.push({
        id: `order-${o.id}`,
        source: 'ORDER',
        date: o.createdAt,
        description: `Order #${o.orderNumber.slice(0, 8).toUpperCase()} placed`,
        amount: Number(o.totalAmount),
        direction: 'DEBIT',
        status: o.status,
        referenceId: o.id,
        runningBalance: null,
      });
    }

    for (const p of payments) {
      entries.push({
        id: `payment-${p.id}`,
        source: 'PAYMENT',
        date: p.createdAt,
        description: `Payment via ${p.provider} for order #${p.order.orderNumber.slice(0, 8).toUpperCase()}`,
        amount: Number(p.amount),
        direction: 'CREDIT',
        status: p.status,
        referenceId: p.orderId,
        runningBalance: null,
      });
    }

    for (const r of returns) {
      const typeLabel = r.type === ReturnType.REPLACEMENT ? 'Replacement' : 'Return';
      entries.push({
        id: `return-${r.id}`,
        source: 'RETURN',
        date: r.createdAt,
        description: `${typeLabel} request for order #${r.order.orderNumber.slice(0, 8).toUpperCase()}`,
        amount: r.refundAmount ? Number(r.refundAmount) : 0,
        direction: 'CREDIT',
        status: r.status,
        referenceId: r.orderId,
        runningBalance: null,
      });
    }

    for (const rf of refunds) {
      entries.push({
        id: `refund-${rf.id}`,
        source: 'REFUND',
        date: rf.createdAt,
        description: `Refund for order #${rf.payment.order.orderNumber.slice(0, 8).toUpperCase()}`,
        amount: Number(rf.amount),
        direction: 'CREDIT',
        status: rf.status,
        referenceId: rf.payment.orderId,
        runningBalance: null,
      });
    }

    for (const wt of walletTransactions) {
      const direction: LedgerDirection = CREDIT_WALLET_TYPES.has(wt.type.toUpperCase()) ? 'CREDIT' : 'DEBIT';
      entries.push({
        id: `wallet-${wt.id}`,
        source: 'WALLET',
        date: wt.createdAt,
        description: wt.description || `Wallet ${wt.type.toLowerCase()}`,
        amount: Number(wt.amount),
        direction,
        status: wt.type,
        referenceId: wt.referenceId || wt.id,
        runningBalance: Number(wt.balance),
      });
    }

    entries.sort((a, b) => b.date.getTime() - a.date.getTime());

    const filtered = filters.sources && filters.sources.length > 0
      ? entries.filter((e) => filters.sources!.includes(e.source))
      : entries;

    const returnRequests = returns.filter((r) => r.type === ReturnType.RETURN);
    const replacementRequests = returns.filter((r) => r.type === ReturnType.REPLACEMENT);
    const pendingOrders = orders.filter((o) => {
      const paymentStatus = o.payment?.status;
      return !paymentStatus || paymentStatus === 'PENDING' || paymentStatus === 'AUTHORIZED' || paymentStatus === 'REFUND_PENDING';
    });

    const summary = {
      totalOrders: orders.length,
      totalOrderValue: orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      paymentsMade: payments.filter((p) => p.status === 'CAPTURED').reduce((sum, p) => sum + Number(p.amount), 0),
      pendingAmount: pendingOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      returnsCount: returnRequests.length,
      returnsAmount: returnRequests.reduce((sum, r) => sum + (r.refundAmount ? Number(r.refundAmount) : 0), 0),
      replacementsCount: replacementRequests.length,
      refundsTotal: refunds.filter((rf) => rf.status === 'PROCESSED').reduce((sum, rf) => sum + Number(rf.amount), 0),
      credits: walletTransactions
        .filter((wt) => CREDIT_WALLET_TYPES.has(wt.type.toUpperCase()))
        .reduce((sum, wt) => sum + Number(wt.amount), 0),
      debits: walletTransactions
        .filter((wt) => !CREDIT_WALLET_TYPES.has(wt.type.toUpperCase()))
        .reduce((sum, wt) => sum + Number(wt.amount), 0),
      walletBalance: creditInfo.balance,
      creditLimit: creditInfo.creditLimit,
      availableCredit: creditInfo.availableCredit,
    };

    return { summary, entries: filtered };
  }
}
