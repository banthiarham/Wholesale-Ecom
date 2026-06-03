import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { OrdersService } from '../orders/orders.service';
import { BulkOrderStatus } from '@prisma/client';

@Injectable()
export class BulkOrdersService {
  constructor(
    private prisma: PrismaService,
    private pricingService: PricingService,
    private ordersService: OrdersService,
  ) {}

  async quickOrder(userId: string, items: { sku: string; quantity: number }[], data: { shippingAddress?: any; notes?: string }) {
    const errors: string[] = [];
    const orderItems: { productId: string; quantity: number }[] = [];
    const bulkOrderItemsData: any[] = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = await this.prisma.product.findUnique({ where: { sku: item.sku } });
      if (!product) {
        errors.push(`Product with SKU "${item.sku}" not found`);
        continue;
      }
      if (product.status !== 'PUBLISHED') {
        errors.push(`Product "${item.sku}" is not available`);
        continue;
      }
      if (item.quantity < product.moq) {
        errors.push(`MOQ for "${item.sku}" is ${product.moq}`);
        continue;
      }
      const available = product.inventoryQuantity - product.reservedQuantity;
      if (product.manageInventory && item.quantity > available && !product.allowBackorder) {
        errors.push(`Not enough stock for "${item.sku}" (available: ${available})`);
        continue;
      }

      orderItems.push({ productId: product.id, quantity: item.quantity });

      // Build BulkOrderItem data for tracking in bulk orders
      const pricing = await this.pricingService.calculateEffectivePrice(product.id, item.quantity, userId);
      const unitPrice = pricing.finalPrice;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      bulkOrderItemsData.push({
        product: { connect: { id: product.id } },
        sku: product.sku,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        notes: `Quick order: ${item.sku} x${item.quantity}`,
      });
    }

    if (orderItems.length === 0) {
      throw new BadRequestException('No valid items to order. Errors: ' + errors.join('; '));
    }

    // Create the real Order
    const result = await this.ordersService.createFromBulk(userId, orderItems, {
      shippingAddress: data.shippingAddress,
      notes: data.notes || 'Quick order',
    });

    // Also create a BulkOrder record (PLACED status) so it shows in bulk orders panel
    const bulkOrderNumber = 'BULK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

    const bulkOrder = await this.prisma.bulkOrder.create({
      data: {
        bulkOrderNumber,
        user: { connect: { id: userId } },
        status: BulkOrderStatus.PLACED,
        shippingAddress: data.shippingAddress || null,
        notes: data.notes || 'Quick order',
        totalAmount,
        order: { connect: { id: result.order.id } },
        items: { create: bulkOrderItemsData },
      },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });

    return { order: result.order, bulkOrder, errors: errors.length > 0 ? errors : undefined };
  }

  async createDraftFromExcel(userId: string, buffer: Buffer, shippingAddress: any, notes?: string) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      throw new BadRequestException('Excel file is empty or has no data rows');
    }

    return this.processRows(userId, rows, shippingAddress, notes);
  }

  private async processRows(userId: string, rows: any[], shippingAddress: any, notes?: string) {
    const errors: string[] = [];
    const bulkOrderItemsData: any[] = [];
    let totalAmount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sku = (row.sku || row.SKU || '').toString().trim();
      const quantity = parseInt(row.quantity || row.Quantity || row.QTY || row.qty, 10);

      if (!sku || isNaN(quantity) || quantity <= 0) {
        errors.push(`Row ${i + 2}: Invalid SKU or quantity`);
        continue;
      }

      const product = await this.prisma.product.findUnique({ where: { sku } });
      if (!product) {
        errors.push(`Row ${i + 2}: Product with SKU "${sku}" not found`);
        continue;
      }
      if (product.status !== 'PUBLISHED') {
        errors.push(`Row ${i + 2}: Product "${sku}" is not available`);
        continue;
      }
      if (quantity < product.moq) {
        errors.push(`Row ${i + 2}: MOQ for "${sku}" is ${product.moq}`);
        continue;
      }

      const available = product.inventoryQuantity - product.reservedQuantity;
      if (product.manageInventory && quantity > available && !product.allowBackorder) {
        errors.push(`Row ${i + 2}: Not enough stock for "${sku}" (available: ${available})`);
        continue;
      }

      const pricing = await this.pricingService.calculateEffectivePrice(product.id, quantity, userId);
      const unitPrice = pricing.finalPrice;
      const totalPrice = unitPrice * quantity;
      totalAmount += totalPrice;

      const rowNotes = (row.notes || row.Notes || '').toString().trim();

      bulkOrderItemsData.push({
        product: { connect: { id: product.id } },
        sku: product.sku,
        quantity,
        unitPrice,
        totalPrice,
        notes: rowNotes || undefined,
        metadata: { pricing, sku: product.sku },
      });
    }

    if (bulkOrderItemsData.length === 0) {
      throw new BadRequestException('No valid items to create bulk order. Errors: ' + errors.join('; '));
    }

    const bulkOrderNumber = 'BULK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

    const bulkOrder = await this.prisma.bulkOrder.create({
      data: {
        bulkOrderNumber,
        user: { connect: { id: userId } },
        status: BulkOrderStatus.DRAFT,
        shippingAddress,
        notes: notes || 'Bulk Excel upload',
        totalAmount,
        items: { create: bulkOrderItemsData },
      },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true, moq: true, inventoryQuantity: true, reservedQuantity: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return { bulkOrder, errors: errors.length > 0 ? errors : undefined };
  }

  async findAll(userId: string, effectiveRole: string, status?: BulkOrderStatus) {
    const isAdmin = effectiveRole === 'ADMIN';
    const where: any = {};
    if (!isAdmin) where.userId = userId;
    if (status) where.status = status;

    return this.prisma.bulkOrder.findMany({
      where,
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string, effectiveRole: string) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true, moq: true, unitPrice: true, inventoryQuantity: true, reservedQuantity: true, manageInventory: true, allowBackorder: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });

    if (!bulkOrder) throw new NotFoundException('Bulk order not found');
    const isAdmin = effectiveRole === 'ADMIN';
    if (!isAdmin && bulkOrder.userId !== userId) throw new ForbiddenException('Access denied');

    return bulkOrder;
  }

  async updateItemQuantity(bulkOrderId: string, itemId: string, quantity: number, userId: string) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({ where: { id: bulkOrderId } });
    if (!bulkOrder) throw new NotFoundException('Bulk order not found');
    if (bulkOrder.userId !== userId) throw new ForbiddenException('Access denied');
    if (bulkOrder.status !== BulkOrderStatus.DRAFT) throw new BadRequestException('Can only edit items in DRAFT status');

    const item = await this.prisma.bulkOrderItem.findUnique({ where: { id: itemId } });
    if (!item || item.bulkOrderId !== bulkOrderId) throw new NotFoundException('Bulk order item not found');

    // Re-validate MOQ
    const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
    if (product && quantity < product.moq) {
      throw new BadRequestException(`Minimum order quantity for "${product.title}" is ${product.moq}`);
    }

    // Re-validate stock
    if (product?.manageInventory && quantity > (product.inventoryQuantity - product.reservedQuantity) && !product.allowBackorder) {
      throw new BadRequestException(`Not enough stock for "${product.title}" (available: ${product.inventoryQuantity - product.reservedQuantity})`);
    }

    // Recalculate pricing with new quantity
    const pricing = await this.pricingService.calculateEffectivePrice(item.productId, quantity, userId);
    const unitPrice = pricing.finalPrice;
    const totalPrice = unitPrice * quantity;

    const updatedItem = await this.prisma.bulkOrderItem.update({
      where: { id: itemId },
      data: { quantity, unitPrice, totalPrice },
    });

    // Recalculate total amount for the bulk order
    const allItems = await this.prisma.bulkOrderItem.findMany({ where: { bulkOrderId } });
    const totalAmount = allItems.reduce((sum, i) => sum + Number(i.totalPrice), 0);
    await this.prisma.bulkOrder.update({
      where: { id: bulkOrderId },
      data: { totalAmount },
    });

    return updatedItem;
  }

  async placeOrder(bulkOrderId: string, userId: string) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({
      where: { id: bulkOrderId },
      include: { items: true },
    });

    if (!bulkOrder) throw new NotFoundException('Bulk order not found');
    if (bulkOrder.userId !== userId) throw new ForbiddenException('Access denied');
    if (bulkOrder.status !== BulkOrderStatus.DRAFT) throw new BadRequestException('Can only place a DRAFT bulk order');
    if (bulkOrder.items.length === 0) throw new BadRequestException('Bulk order has no items');

    // Create the real order using existing service
    const items = bulkOrder.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    const result = await this.ordersService.createFromBulk(userId, items, {
      shippingAddress: bulkOrder.shippingAddress,
      notes: bulkOrder.notes,
    });

    // Update the bulk order
    const updatedBulkOrder = await this.prisma.bulkOrder.update({
      where: { id: bulkOrderId },
      data: {
        status: BulkOrderStatus.PLACED,
        orderId: result.order.id,
        totalAmount: result.order.totalAmount,
      },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });

    return { order: result.order, bulkOrder: updatedBulkOrder, errors: result.errors };
  }

  async cancelDraft(bulkOrderId: string, userId: string) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({ where: { id: bulkOrderId } });
    if (!bulkOrder) throw new NotFoundException('Bulk order not found');
    if (bulkOrder.userId !== userId) throw new ForbiddenException('Access denied');
    if (bulkOrder.status !== BulkOrderStatus.DRAFT) throw new BadRequestException('Can only cancel a DRAFT bulk order');

    const updated = await this.prisma.bulkOrder.update({
      where: { id: bulkOrderId },
      data: { status: BulkOrderStatus.CANCELLED },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return updated;
  }
}