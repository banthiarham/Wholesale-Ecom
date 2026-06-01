import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRolePriceDto } from './dto/create-role-price.dto';
import { UpdateRolePriceDto } from './dto/update-role-price.dto';
import { BulkRolePriceDto } from './dto/bulk-role-price.dto';

@Injectable()
export class RolePricesService {
  constructor(private prisma: PrismaService) {}

  async findAll(productId?: string, roleId?: string) {
    const where: any = {};
    if (productId) where.productId = productId;
    if (roleId) where.roleId = roleId;

    const rolePrices = await this.prisma.rolePrice.findMany({
      where,
      include: {
        product: { select: { id: true, title: true, handle: true } },
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
      orderBy: [{ productId: 'asc' }, { roleId: 'asc' }],
    });
    return rolePrices;
  }

  async findById(id: string) {
    const rolePrice = await this.prisma.rolePrice.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, title: true, handle: true } },
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
    });
    if (!rolePrice) throw new NotFoundException(`Role price "${id}" not found`);
    return rolePrice;
  }

  async create(dto: CreateRolePriceDto) {
    // Verify product and role exist
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product "${dto.productId}" not found`);

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException(`Role "${dto.roleId}" not found`);

    // Check for uniqueness
    const existing = await this.prisma.rolePrice.findUnique({
      where: { productId_roleId: { productId: dto.productId, roleId: dto.roleId } },
    });
    if (existing) {
      throw new ConflictException(
        `Role price already exists for product "${product.title}" and role "${role.label}". Use PUT to update it.`,
      );
    }

    return this.prisma.rolePrice.create({
      data: {
        productId: dto.productId,
        roleId: dto.roleId,
        price: dto.price,
        minQty: dto.minQty ?? 1,
        isActive: dto.isActive ?? true,
      },
      include: {
        product: { select: { id: true, title: true, handle: true } },
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
    });
  }

  async update(id: string, dto: UpdateRolePriceDto) {
    const existing = await this.prisma.rolePrice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Role price "${id}" not found`);

    return this.prisma.rolePrice.update({
      where: { id },
      data: {
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.minQty !== undefined && { minQty: dto.minQty }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        product: { select: { id: true, title: true, handle: true } },
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.rolePrice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Role price "${id}" not found`);
    return this.prisma.rolePrice.delete({ where: { id } });
  }

  async bulkSet(dto: BulkRolePriceDto) {
    // Verify product exists
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product "${dto.productId}" not found`);

    const results = [];

    for (const entry of dto.prices) {
      // Verify role exists
      const role = await this.prisma.role.findUnique({ where: { id: entry.roleId } });
      if (!role) {
        throw new NotFoundException(`Role "${entry.roleId}" not found`);
      }

      // Upsert: create or update
      const result = await this.prisma.rolePrice.upsert({
        where: { productId_roleId: { productId: dto.productId, roleId: entry.roleId } },
        update: {
          price: entry.price,
          minQty: entry.minQty ?? 1,
          isActive: true,
        },
        create: {
          productId: dto.productId,
          roleId: entry.roleId,
          price: entry.price,
          minQty: entry.minQty ?? 1,
          isActive: true,
        },
        include: {
          role: { select: { id: true, name: true, label: true, color: true } },
        },
      });
      results.push(result);
    }

    return results;
  }
}