import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CartService } from '../cart/cart.service';
import {
  CreatePackageTemplateDto,
  UpdatePackageTemplateDto,
  AddPackageToCartDto,
} from './dto/package.dto';

@Injectable()
export class PackagesService {
  constructor(
    private prisma: PrismaService,
    private pricingService: PricingService,
    private cartService: CartService,
  ) {}

  async create(dto: CreatePackageTemplateDto) {
    const { groups, ...templateData } = dto;

    const template = await this.prisma.packageTemplate.create({
      data: {
        ...templateData,
        basePrice: templateData.basePrice ?? 0,
        status: (templateData.status as ProductStatus) || ProductStatus.DRAFT,
        groups: {
          create: groups.map((g, i) => ({
            name: g.name,
            description: g.description,
            required: g.required ?? true,
            minSelect: g.minSelect ?? 1,
            maxSelect: g.maxSelect ?? 1,
            sortOrder: g.sortOrder ?? i,
            discountType: g.discountType,
            discountValue: g.discountValue,
            maxDiscount: g.maxDiscount,
            categoryId: g.categoryId,
            products: g.productIds
              ? {
                  create: g.productIds.map((pid, j) => ({
                    productId: pid,
                    sortOrder: j,
                    isDefault: pid === g.defaultProductId,
                  })),
                }
              : undefined,
          })),
        },
      },
      include: { groups: { include: { products: { include: { product: true } } } } },
    });

    return template;
  }

  async findAll(status?: string) {
    const where = status ? { status: status as ProductStatus } : {};
    return this.prisma.packageTemplate.findMany({
      where,
      include: { groups: { include: { products: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const template = await this.prisma.packageTemplate.findUnique({
      where: { id },
      include: { groups: { include: { products: { include: { product: true } }, category: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Package template not found');
    return template;
  }

  async findByHandle(handle: string) {
    const template = await this.prisma.packageTemplate.findUnique({
      where: { handle },
      include: { groups: { include: { products: { include: { product: true } }, category: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Package template not found');
    return template;
  }

  async update(id: string, dto: UpdatePackageTemplateDto) {
    const existing = await this.prisma.packageTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Package template not found');

    const { groups, ...templateData } = dto;

    // Cast status string to ProductStatus enum for Prisma
    const data: any = { ...templateData };
    if (data.status) {
      data.status = data.status as ProductStatus;
    }

    // If groups are provided, replace all groups
    if (groups && groups.length > 0) {
      // Delete existing groups (cascades to products)
      await this.prisma.packageGroupProduct.deleteMany({
        where: { group: { packageId: id } },
      });
      await this.prisma.packageGroup.deleteMany({
        where: { packageId: id },
      });
    }

    const template = await this.prisma.packageTemplate.update({
      where: { id },
      data: {
        ...data,
        ...(groups && groups.length > 0
          ? {
              groups: {
                create: groups.map((g, i) => ({
                  name: g.name!,
                  description: g.description,
                  required: g.required ?? true,
                  minSelect: g.minSelect ?? 1,
                  maxSelect: g.maxSelect ?? 1,
                  sortOrder: g.sortOrder ?? i,
                  discountType: g.discountType,
                  discountValue: g.discountValue,
                  maxDiscount: g.maxDiscount,
                  categoryId: g.categoryId,
                  products: g.productIds
                    ? {
                        create: g.productIds.map((pid, j) => ({
                          productId: pid,
                          sortOrder: j,
                          isDefault: pid === g.defaultProductId,
                        })),
                      }
                    : undefined,
                })),
              },
            }
          : {}),
      },
      include: { groups: { include: { products: { include: { product: true } } } } },
    });

    return template;
  }

  async remove(id: string) {
    const existing = await this.prisma.packageTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Package template not found');

    // Delete in order: group products → groups → template
    await this.prisma.packageGroupProduct.deleteMany({
      where: { group: { packageId: id } },
    });
    await this.prisma.packageGroup.deleteMany({ where: { packageId: id } });
    await this.prisma.packageTemplate.delete({ where: { id } });

    return { success: true };
  }

  async getGroupProducts(groupId: string) {
    const group = await this.prisma.packageGroup.findUnique({
      where: { id: groupId },
      include: { products: { include: { product: true } }, category: true },
    });
    if (!group) throw new NotFoundException('Package group not found');

    // If category is set, return all published products in that category
    if (group.categoryId) {
      const categoryProducts = await this.prisma.product.findMany({
        where: { categoryId: group.categoryId, status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          handle: true,
          unitPrice: true,
          compareAtPrice: true,
          thumbnail: true,
          images: true,
          sku: true,
          moq: true,
          inventoryQuantity: true,
          tierPrices: { orderBy: { minQty: 'asc' } },
        },
      });

      // Merge with explicitly added products
      const explicitProductIds = group.products.map((p) => p.productId);
      const merged = [...categoryProducts];
      for (const ep of group.products) {
        if (!merged.find((p) => p.id === ep.productId) && ep.product) {
          merged.push(ep.product as any);
        }
      }

      return {
        groupId: group.id,
        groupName: group.name,
        products: merged,
        explicitProductIds,
        defaultProductId: group.products.find((p) => p.isDefault)?.productId || null,
      };
    }

    // Otherwise, return only explicitly listed products
    return {
      groupId: group.id,
      groupName: group.name,
      products: group.products.map((p) => ({
        id: p.product.id,
        title: p.product.title,
        handle: p.product.handle,
        unitPrice: p.product.unitPrice,
        compareAtPrice: p.product.compareAtPrice,
        thumbnail: p.product.thumbnail,
        images: p.product.images,
        sku: p.product.sku,
        moq: p.product.moq,
        inventoryQuantity: p.product.inventoryQuantity,
        tierPrices: (p.product as any).tierPrices || [],
        isDefault: p.isDefault,
      })),
      explicitProductIds: group.products.map((p) => p.productId),
      defaultProductId: group.products.find((p) => p.isDefault)?.productId || null,
    };
  }

  async calculatePackagePrice(
    packageId: string,
    selections: { groupId: string; productId: string }[],
    userId?: string,
  ) {
    const template = await this.findById(packageId);
    let basePrice = Number(template.basePrice);
    const components: any[] = [];
    const groupDiscounts: any[] = [];
    let totalGroupDiscount = 0;

    // Validate selections
    for (const group of template.groups) {
      const selection = selections.find((s) => s.groupId === group.id);

      if (group.required && !selection) {
        throw new BadRequestException(`Required group "${group.name}" has no selection`);
      }

      if (!selection) continue;

      // Validate product belongs to group
      const groupProducts = await this.getGroupProducts(group.id);
      const validProduct = groupProducts.products.find((p: any) => p.id === selection.productId);
      if (!validProduct) {
        throw new BadRequestException(`Product ${selection.productId} is not available in group "${group.name}"`);
      }

      // Get pricing for this product
      const pricing = await this.pricingService.calculateEffectivePrice(
        selection.productId,
        1,
        userId,
      );

      const unitPrice = pricing.finalPrice;
      let lineTotal = unitPrice;
      let discountAmount = 0;

      // Apply group discount
      if (group.discountType && group.discountValue) {
        if (group.discountType === 'PERCENTAGE') {
          discountAmount = (unitPrice * Number(group.discountValue)) / 100;
          if (group.maxDiscount) {
            discountAmount = Math.min(discountAmount, Number(group.maxDiscount));
          }
        } else if (group.discountType === 'FLAT') {
          discountAmount = Number(group.discountValue);
        }
        lineTotal -= discountAmount;
        totalGroupDiscount += discountAmount;

        groupDiscounts.push({
          groupId: group.id,
          groupName: group.name,
          discountType: group.discountType,
          discountValue: Number(group.discountValue),
          discountAmount,
        });
      }

      components.push({
        groupId: group.id,
        groupName: group.name,
        productId: selection.productId,
        productTitle: validProduct.title,
        productThumbnail: validProduct.thumbnail,
        unitPrice,
        groupDiscount: discountAmount,
        lineTotal,
      });
    }

    const subtotal = basePrice + components.reduce((sum, c) => sum + c.lineTotal, 0);

    return {
      packageId,
      packageTitle: template.title,
      basePrice,
      components,
      groupDiscounts,
      totalGroupDiscount,
      subtotal,
    };
  }

  async addPackageToCart(dto: AddPackageToCartDto, userId?: string, sessionId?: string) {
    const { packageId, selections, quantity = 1 } = dto;

    // Validate and calculate price
    const priceBreakdown = await this.calculatePackagePrice(packageId, selections, userId);

    // Distribute base price across components proportionally
    const totalComponentPrice = priceBreakdown.components.reduce((sum, c) => sum + c.unitPrice, 0);
    const basePricePerItem = totalComponentPrice > 0 ? priceBreakdown.basePrice / totalComponentPrice : 0;

    // Add each component to the cart via CartService (ensures same cart as the cart page)
    for (const component of priceBreakdown.components) {
      const effectivePrice = component.unitPrice + basePricePerItem - component.groupDiscount;

      const metadata = {
        pricing: { basePrice: component.unitPrice, finalPrice: component.unitPrice },
        packageId,
        packageTitle: priceBreakdown.packageTitle,
        packageBasePrice: priceBreakdown.basePrice,
        selectedComponents: priceBreakdown.components.map((c) => ({
          groupId: c.groupId,
          groupName: c.groupName,
          productId: c.productId,
          productTitle: c.productTitle,
          unitPrice: c.unitPrice,
          groupDiscount: c.groupDiscount,
          lineTotal: c.lineTotal,
        })),
        groupDiscounts: priceBreakdown.groupDiscounts,
        packageTotal: priceBreakdown.subtotal * quantity,
      };

      await this.cartService.addItem(
        component.productId,
        quantity,
        userId,
        sessionId,
        component.groupId, // packageGroupId
        metadata,
      );
    }

    // Return updated cart with totals
    const cart = await this.cartService.getOrCreateCart(userId, sessionId);
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }
}