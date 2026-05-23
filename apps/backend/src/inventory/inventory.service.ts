import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryTransactionType } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getInventory(vendorId?: string) {
    const where: any = {};
    if (vendorId) where.vendorId = vendorId;
    return this.prisma.product.findMany({
      where,
      select: {
        id: true,
        title: true,
        sku: true,
        inventoryQuantity: true,
        reservedQuantity: true,
        moq: true,
        status: true,
        vendorId: true,
        vendorName: true,
      },
      orderBy: { title: 'asc' },
    });
  }

  async getProductInventory(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        sku: true,
        inventoryQuantity: true,
        reservedQuantity: true,
        moq: true,
        status: true,
        vendorId: true,
        vendorName: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async adjustStock(productId: string, adjustment: number, reason: string, notes?: string, createdBy?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const previousQty = product.inventoryQuantity;
    const newQty = previousQty + adjustment;
    if (newQty < 0 && !product.allowBackorder) {
      throw new BadRequestException('Adjustment would result in negative inventory');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { inventoryQuantity: newQty },
    });

    await this.prisma.stockAdjustment.create({
      data: { productId, adjustment, reason, notes, createdBy },
    });

    await this.prisma.inventoryLog.create({
      data: {
        productId,
        type: adjustment >= 0 ? InventoryTransactionType.STOCK_IN : InventoryTransactionType.STOCK_OUT,
        quantity: Math.abs(adjustment),
        previousQty,
        newQty,
        reason,
        referenceType: 'ADJUSTMENT',
        createdBy,
      },
    });

    return updated;
  }

  async reserveStock(productId: string, quantity: number, referenceId?: string, createdBy?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const available = product.inventoryQuantity - product.reservedQuantity;
    if (quantity > available && !product.allowBackorder) {
      throw new BadRequestException(`Insufficient available stock for ${product.title}: ${available} available, ${quantity} requested`);
    }

    const previousQty = product.reservedQuantity;
    const newQty = previousQty + quantity;

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { reservedQuantity: newQty },
    });

    await this.prisma.inventoryLog.create({
      data: {
        productId,
        type: InventoryTransactionType.RESERVED,
        quantity,
        previousQty: product.inventoryQuantity,
        newQty: product.inventoryQuantity,
        reason: 'Order reservation',
        referenceId,
        referenceType: 'ORDER',
        createdBy,
      },
    });

    return updated;
  }

  async releaseStock(productId: string, quantity: number, referenceId?: string, createdBy?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const previousQty = product.reservedQuantity;
    const newQty = Math.max(0, previousQty - quantity);

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { reservedQuantity: newQty },
    });

    await this.prisma.inventoryLog.create({
      data: {
        productId,
        type: InventoryTransactionType.RELEASED,
        quantity,
        previousQty: product.inventoryQuantity,
        newQty: product.inventoryQuantity,
        reason: 'Order cancellation / release',
        referenceId,
        referenceType: 'ORDER',
        createdBy,
      },
    });

    return updated;
  }

  async deductStockOnShip(productId: string, quantity: number, referenceId?: string, createdBy?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const previousQty = product.inventoryQuantity;
    const newQty = previousQty - quantity;
    const newReserved = Math.max(0, product.reservedQuantity - quantity);

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { inventoryQuantity: newQty, reservedQuantity: newReserved },
    });

    await this.prisma.inventoryLog.create({
      data: {
        productId,
        type: InventoryTransactionType.STOCK_OUT,
        quantity,
        previousQty,
        newQty,
        reason: 'Order shipped',
        referenceId,
        referenceType: 'ORDER',
        createdBy,
      },
    });

    return updated;
  }

  async getLogs(productId: string, limit = 50) {
    return this.prisma.inventoryLog.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
