import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PricingService } from '../pricing/pricing.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class CsvOrderParserService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private pricingService: PricingService,
  ) {}

  async parseAndCreateOrder(userId: string, buffer: Buffer, shippingAddress: any, notes?: string) {
    const csv = require('csv-parser');
    const { Readable } = require('stream');

    const rows: any[] = [];
    const stream = Readable.from(buffer.toString());

    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data: any) => rows.push(data))
        .on('end', async () => {
          try {
            const result = await this.processRows(userId, rows, shippingAddress, notes);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (err: any) => reject(err));
    });
  }

  private async processRows(userId: string, rows: any[], shippingAddress: any, notes?: string) {
    const errors: string[] = [];
    const orderItemsData: any[] = [];
    let totalAmount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sku = row.sku?.trim();
      const quantity = parseInt(row.quantity, 10);

      if (!sku || isNaN(quantity) || quantity <= 0) {
        errors.push(`Row ${i + 1}: Invalid SKU or quantity`);
        continue;
      }

      const product = await this.prisma.product.findUnique({ where: { sku } });
      if (!product) {
        errors.push(`Row ${i + 1}: Product with SKU "${sku}" not found`);
        continue;
      }
      if (product.status !== 'PUBLISHED') {
        errors.push(`Row ${i + 1}: Product "${sku}" is not available`);
        continue;
      }
      if (quantity < product.moq) {
        errors.push(`Row ${i + 1}: MOQ for "${sku}" is ${product.moq}`);
        continue;
      }

      const available = product.inventoryQuantity - product.reservedQuantity;
      if (product.manageInventory && quantity > available && !product.allowBackorder) {
        errors.push(`Row ${i + 1}: Not enough stock for "${sku}" (available: ${available})`);
        continue;
      }

      const pricing = await this.pricingService.calculateEffectivePrice(product.id, quantity, userId);
      const unitPrice = pricing.finalPrice;
      const totalPrice = unitPrice * quantity;
      totalAmount += totalPrice;

      orderItemsData.push({
        productId: product.id,
        quantity,
        unitPrice,
        totalPrice,
        metadata: { pricing, sku: product.sku, notes: row.notes },
      });
    }

    if (orderItemsData.length === 0) {
      throw new BadRequestException('No valid items to create order. Errors: ' + errors.join('; '));
    }

    const order = await this.prisma.order.create({
      data: {
        userId,
        totalAmount,
        currency: 'INR',
        shippingAddress,
        billingAddress: shippingAddress,
        notes: notes || 'Bulk CSV upload',
        items: { create: orderItemsData },
      },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Reserve inventory
    for (const item of order.items) {
      try {
        await this.inventoryService.reserveStock(item.productId, item.quantity, order.id, userId);
      } catch (err) {
        console.error(`Failed to reserve stock for ${item.productId}:`, err.message);
      }
    }

    return { order, errors: errors.length > 0 ? errors : undefined };
  }
}
