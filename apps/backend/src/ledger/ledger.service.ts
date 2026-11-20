import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ReturnType } from '@prisma/client';
import { PaymentReceiptsService } from '../orders/payment-receipts.service';

export type LedgerSource = 'OPENING' | 'ORDER' | 'PAYMENT' | 'RETURN' | 'REFUND' | 'WALLET';
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

const round2 = (n: number) => Math.round(n * 100) / 100;

const CREDIT_WALLET_TYPES = new Set(['CREDIT', 'TOPUP', 'REFUND', 'CASHBACK']);

@Injectable()
export class LedgerService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
  ) {}

  /**
   * Sets (or changes, or clears) a user's ledger opening balance. `side` says who owes whom:
   * DEBIT = the customer owes us `amount`; CREDIT = we hold an advance of `amount` for them. Amount 0 clears it.
   */
  async setOpeningBalance(
    userId: string,
    adminId: string,
    input: { amount: number; side?: 'DEBIT' | 'CREDIT'; asOn?: string; note?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    const amount = round2(Number(input.amount));
    if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('Enter the opening balance as 0 or more');
    if (amount > 9999999999) throw new BadRequestException('That amount is too large');
    if (amount > 0 && input.side !== 'DEBIT' && input.side !== 'CREDIT') {
      throw new BadRequestException('Say whether the customer owes you (Dr) or has paid in advance (Cr)');
    }
    let asOn: Date | null = null;
    if (amount > 0 && input.asOn) {
      // Midday UTC: the same calendar day in every timezone from India to the Americas (a plain date, no clock time).
      asOn = new Date(`${input.asOn}T12:00:00Z`);
      if (isNaN(asOn.getTime())) throw new BadRequestException('Enter a valid "as on" date');
    }
    const note = input.note?.trim().slice(0, 200) || null;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        openingBalance: amount === 0 ? 0 : input.side === 'CREDIT' ? -amount : amount,
        openingBalanceDate: amount === 0 ? null : asOn,
        openingBalanceNote: amount === 0 ? null : note,
        openingBalanceUpdatedBy: adminId,
        openingBalanceUpdatedAt: new Date(),
      },
    });
    return this.getLedger(userId);
  }

  async getLedger(userId: string, filters: LedgerFilters = {}) {
    const dateFilter =
      filters.from || filters.to
        ? { gte: filters.from, lte: filters.to }
        : undefined;

    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { openingBalance: true, openingBalanceDate: true, openingBalanceNote: true, openingBalanceUpdatedAt: true },
    });
    if (!account) throw new NotFoundException('User not found');

    const [orders, payments, returns, refunds, walletTransactions, creditInfo] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { payment: { include: { receipts: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        // Not date-filtered here: part-payment receipts are dated by when the money came in (filtered below).
        where: { order: { userId } },
        include: { order: { select: { orderNumber: true, invoiceNumber: true } }, receipts: true },
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
      // Part payments: each verified receipt is its own credit, dated when the money came in.
      const liveReceipts = p.receipts.filter((r) => r.status !== 'REJECTED');
      if (liveReceipts.length > 0) {
        for (const r of p.receipts.filter((x) => x.status === 'VERIFIED')) {
          if ((filters.from && r.receivedAt < filters.from) || (filters.to && r.receivedAt > filters.to)) continue;
          entries.push({
            id: `receipt-${r.id}`,
            source: 'PAYMENT',
            date: r.receivedAt,
            description: `Payment received via ${r.method.replace(/_/g, ' ')}${r.reference ? ` (Ref ${r.reference})` : ''} for order ${p.order.invoiceNumber || '#' + p.order.orderNumber.slice(0, 8).toUpperCase()}`,
            amount: Number(r.amount),
            direction: 'CREDIT',
            status: 'RECEIVED',
            referenceId: p.orderId,
            runningBalance: null,
          });
        }
        continue;
      }
      if ((filters.from && p.createdAt < filters.from) || (filters.to && p.createdAt > filters.to)) continue;
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

    // Opening balance: what the customer owed us (or we held for them) when the books started. A positive
    // amount is a debit, a negative one a credit. It is dated by its "as on" date and, like any entry, left out
    // of a date-filtered view when that date falls outside the range.
    const opening = Number(account.openingBalance);
    if (opening !== 0) {
      const asOn = account.openingBalanceDate || account.openingBalanceUpdatedAt || new Date(0);
      if (!((filters.from && asOn < filters.from) || (filters.to && asOn > filters.to))) {
        entries.push({
          id: `opening-${userId}`,
          source: 'OPENING',
          date: asOn,
          description: `Opening balance${account.openingBalanceNote ? ` — ${account.openingBalanceNote}` : ''}`,
          amount: Math.abs(opening),
          direction: opening > 0 ? 'DEBIT' : 'CREDIT',
          status: opening > 0 ? 'DUE FROM CUSTOMER' : 'ADVANCE HELD',
          referenceId: userId,
          runningBalance: null,
        });
      }
    }

    entries.sort((a, b) => b.date.getTime() - a.date.getTime());

    const filtered = filters.sources && filters.sources.length > 0
      ? entries.filter((e) => filters.sources!.includes(e.source))
      : entries;

    const returnRequests = returns.filter((r) => r.type === ReturnType.RETURN);
    const replacementRequests = returns.filter((r) => r.type === ReturnType.REPLACEMENT);
    // Paid so far per order: verified part-payment receipts, or the whole order once its payment is captured.
    const paidOf = (o: (typeof orders)[number]) => PaymentReceiptsService.summarize(Number(o.totalAmount), o.payment as any).paid;
    const openOrders = orders.filter((o) => o.status !== 'CANCELLED' && o.payment?.status !== 'REFUNDED');

    const openOrdersDue = openOrders.reduce((sum, o) => sum + Math.max(0, Number(o.totalAmount) - paidOf(o)), 0);

    const summary = {
      totalOrders: orders.length,
      totalOrderValue: orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      paymentsMade: orders.reduce((sum, o) => sum + paidOf(o), 0),
      pendingAmount: openOrdersDue,
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
      openingBalance: opening,
      openingBalanceDate: account.openingBalanceDate,
      openingBalanceNote: account.openingBalanceNote,
      // Everything the customer owes: the opening balance, what is unpaid on open orders, and wallet credit in use.
      totalOutstanding: round2(opening + openOrdersDue + Math.max(0, -creditInfo.balance)),
      walletBalance: creditInfo.balance,
      creditLimit: creditInfo.creditLimit,
      availableCredit: creditInfo.availableCredit,
    };

    return { summary, entries: filtered };
  }
}
