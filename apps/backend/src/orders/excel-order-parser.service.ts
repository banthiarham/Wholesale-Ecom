import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PricingService } from '../pricing/pricing.service';
import { RulesEnforcementService } from '../rules/rules-enforcement.service';
import { CartItemContext } from '../rules/rules-engine.service';

@Injectable()
export class ExcelOrderParserService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private pricingService: PricingService,
    private rulesEnforcement: RulesEnforcementService,
  ) {}

  async parseAndCreateOrder(userId: string, buffer: Buffer, shippingAddress: any, notes?: string) {
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
    const orderItemsData: any[] = [];
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

      orderItemsData.push({
        productId: product.id,
        quantity,
        unitPrice,
        totalPrice,
        metadata: { pricing, sku: product.sku, notes: rowNotes || undefined },
      });
    }

    if (orderItemsData.length === 0) {
      throw new BadRequestException('No valid items to create order. Errors: ' + errors.join('; '));
    }

    // Enforce dynamic rules before creating the order
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const excelCartItems: CartItemContext[] = orderItemsData.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    await this.rulesEnforcement.enforceOrderRules({
      userId,
      userRole: (user as any)?.effectiveRole || (user as any)?.roleRel?.name || user?.role || undefined,
      cartItems: excelCartItems,
      subtotal: totalAmount,
    });

    const order = await this.prisma.order.create({
      data: {
        userId,
        totalAmount,
        currency: 'INR',
        shippingAddress,
        billingAddress: shippingAddress,
        notes: notes || 'Bulk Excel upload',
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