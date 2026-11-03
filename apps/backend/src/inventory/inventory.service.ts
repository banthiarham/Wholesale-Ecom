import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryTransactionType } from '@prisma/client';
import { syncProductFromVariants } from '../products/variant-sync';

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

  async reserveStock(productId: string, quantity: number, referenceId?: string, createdBy?: string, variantId?: string | null) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    // Variant products hold stock per variant; the product totals are re-derived afterwards.
    if (variantId) {
      const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
      if (!variant) throw new NotFoundException('Variant not found');
      const variantAvailable = variant.inventoryQuantity - variant.reservedQuantity;
      if (quantity > variantAvailable && !product.allowBackorder) {
        throw new BadRequestException(`Insufficient available stock for ${product.title} (${variant.sku}): ${variantAvailable} available, ${quantity} requested`);
      }
      await this.prisma.productVariant.update({ where: { id: variantId }, data: { reservedQuantity: { increment: quantity } } });
      await syncProductFromVariants(this.prisma, productId);
      await this.prisma.inventoryLog.create({
        data: {
          productId,
          type: InventoryTransactionType.RESERVED,
          quantity,
          previousQty: variant.inventoryQuantity,
          newQty: variant.inventoryQuantity,
          reason: `Order reservation (variant ${variant.sku})`,
          referenceId,
          referenceType: 'ORDER',
          createdBy,
        },
      });
      return this.prisma.product.findUnique({ where: { id: productId } });
    }

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

  async releaseStock(productId: string, quantity: number, referenceId?: string, createdBy?: string, variantId?: string | null) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    if (variantId) {
      const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
      if (!variant) throw new NotFoundException('Variant not found');
      await this.prisma.productVariant.update({
        where: { id: variantId },
        data: { reservedQuantity: Math.max(0, variant.reservedQuantity - quantity) },
      });
      await syncProductFromVariants(this.prisma, productId);
      await this.prisma.inventoryLog.create({
        data: {
          productId,
          type: InventoryTransactionType.RELEASED,
          quantity,
          previousQty: variant.inventoryQuantity,
          newQty: variant.inventoryQuantity,
          reason: `Order cancellation / release (variant ${variant.sku})`,
          referenceId,
          referenceType: 'ORDER',
          createdBy,
        },
      });
      return this.prisma.product.findUnique({ where: { id: productId } });
    }

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

  /**
   * Where an order's stock currently sits: PENDING/CONFIRMED/PROCESSING hold it as a reservation,
   * SHIPPED/DELIVERED have taken it out of the physical count, CANCELLED/REFUNDED hold nothing.
   */
  private stockPhase(status: string): 'RESERVED' | 'COMMITTED' | 'NONE' {
    if (status === 'SHIPPED' || status === 'DELIVERED') return 'COMMITTED';
    if (status === 'CANCELLED' || status === 'REFUNDED') return 'NONE';
    return 'RESERVED';
  }

  /** Moves stock counters for one product (or variant) by the given amounts and writes the log. */
  private async moveStock(
    productId: string,
    variantId: string | null | undefined,
    change: { inventory: number; reserved: number },
    type: InventoryTransactionType,
    reason: string,
    referenceId?: string,
    createdBy?: string,
  ) {
    if (variantId) {
      const v = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
      if (!v) return;
      await this.prisma.productVariant.update({
        where: { id: variantId },
        data: {
          inventoryQuantity: Math.max(0, v.inventoryQuantity + change.inventory),
          reservedQuantity: Math.max(0, v.reservedQuantity + change.reserved),
        },
      });
      await syncProductFromVariants(this.prisma, productId);
      await this.prisma.inventoryLog.create({
        data: { productId, type, quantity: Math.abs(change.inventory || change.reserved), previousQty: v.inventoryQuantity, newQty: Math.max(0, v.inventoryQuantity + change.inventory), reason: `${reason} (variant ${v.sku})`, referenceId, referenceType: 'ORDER', createdBy },
      });
      return;
    }
    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p) return;
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        inventoryQuantity: Math.max(0, p.inventoryQuantity + change.inventory),
        reservedQuantity: Math.max(0, p.reservedQuantity + change.reserved),
      },
    });
    await this.prisma.inventoryLog.create({
      data: { productId, type, quantity: Math.abs(change.inventory || change.reserved), previousQty: p.inventoryQuantity, newQty: Math.max(0, p.inventoryQuantity + change.inventory), reason, referenceId, referenceType: 'ORDER', createdBy },
    });
  }

  /**
   * Keeps stock right when an order changes status. Call it after every status change with the old and new status:
   * shipping/delivering takes the units out of inventory and drops the reservation; cancelling a pending order frees
   * the reservation; cancelling a shipped one puts the units back on the shelf.
   */
  async applyOrderStatusChange(orderId: string, previousStatus: string, newStatus: string, createdBy?: string) {
    const from = this.stockPhase(previousStatus);
    const to = this.stockPhase(newStatus);
    if (from === to) return;
    // A refund does not say the goods came back, so refunding an already-shipped order leaves stock alone.
    if (from === 'COMMITTED' && newStatus === 'REFUNDED') return;

    const items = await this.prisma.orderItem.findMany({ where: { orderId }, select: { productId: true, quantity: true, variantId: true } });
    for (const it of items) {
      const q = it.quantity;
      if (from === 'RESERVED' && to === 'COMMITTED') await this.moveStock(it.productId, it.variantId, { inventory: -q, reserved: -q }, InventoryTransactionType.STOCK_OUT, 'Order shipped', orderId, createdBy);
      else if (from === 'RESERVED' && to === 'NONE') await this.moveStock(it.productId, it.variantId, { inventory: 0, reserved: -q }, InventoryTransactionType.RELEASED, 'Order cancellation / release', orderId, createdBy);
      else if (from === 'COMMITTED' && to === 'RESERVED') await this.moveStock(it.productId, it.variantId, { inventory: q, reserved: q }, InventoryTransactionType.RESERVED, 'Order moved back from shipped', orderId, createdBy);
      else if (from === 'COMMITTED' && to === 'NONE') await this.moveStock(it.productId, it.variantId, { inventory: q, reserved: 0 }, InventoryTransactionType.STOCK_IN, 'Shipped order cancelled', orderId, createdBy);
      else if (from === 'NONE' && to === 'RESERVED') await this.moveStock(it.productId, it.variantId, { inventory: 0, reserved: q }, InventoryTransactionType.RESERVED, 'Order reinstated', orderId, createdBy);
      else if (from === 'NONE' && to === 'COMMITTED') await this.moveStock(it.productId, it.variantId, { inventory: -q, reserved: 0 }, InventoryTransactionType.STOCK_OUT, 'Order shipped', orderId, createdBy);
    }
  }

  /** An order that already shipped had its quantity edited: the physical count follows the change. */
  async adjustShippedQuantity(productId: string, variantId: string | null | undefined, delta: number, orderId: string, createdBy?: string) {
    if (delta === 0) return;
    await this.moveStock(productId, variantId, { inventory: -delta, reserved: 0 }, delta > 0 ? InventoryTransactionType.STOCK_OUT : InventoryTransactionType.STOCK_IN, 'Shipped order edited', orderId, createdBy);
  }

  async getLogs(productId: string, limit = 50) {
    return this.prisma.inventoryLog.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
