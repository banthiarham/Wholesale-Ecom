import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(activeOnly = true) {
    return this.prisma.category.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { rank: 'asc' },
      include: {
        _count: { select: { products: { where: { status: 'PUBLISHED' } } } },
      },
    });
  }

  async findTree() {
    const categories = await this.findAll(true);
    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const cat of categories) {
      map.set(cat.id, { ...cat, children: [] });
    }

    for (const cat of categories) {
      const node = map.get(cat.id);
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findByHandle(handle: string) {
    const category = await this.prisma.category.findUnique({
      where: { handle },
      include: {
        products: {
          where: { status: 'PUBLISHED' },
          orderBy: { createdAt: 'desc' },
          include: {
            tierPrices: { orderBy: { minQty: 'asc' } },
            _count: { select: { reviews: true } },
          },
        },
        children: true,
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(data: any) {
    return this.prisma.category.create({ data: { ...data, image: data.image || null } });
  }

  async update(id: string, data: any) {
    // An empty string means "remove the image".
    if (data.image === '') data = { ...data, image: null };
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  // Adjusts every existing role price (all quantity tiers) of the given roles across the
  // products directly in this category. All-or-nothing: if any entry is invalid or any result
  // would be zero or negative, nothing is changed.
  async adjustRolePrices(id: string, dto: { adjustments: { roleId: string; percentage?: number; amount?: number }[] }) {
    const roleIds = dto.adjustments.map((a) => a.roleId);
    if (new Set(roleIds).size !== roleIds.length) {
      throw new BadRequestException('Each role can only appear once');
    }
    for (const a of dto.adjustments) {
      const hasPct = a.percentage !== undefined && a.percentage !== null;
      const hasAmt = a.amount !== undefined && a.amount !== null;
      if (hasPct === hasAmt) throw new BadRequestException('Provide either a percentage or an amount per role, not both');
      if (!(hasPct ? a.percentage : a.amount)) throw new BadRequestException('Change must be non-zero');
    }

    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds } } });
    if (roles.length !== roleIds.length) throw new NotFoundException('Role not found');
    const roleLabel = new Map(roles.map((r) => [r.id, r.label || r.name]));

    const rows = await this.prisma.rolePrice.findMany({
      where: { roleId: { in: roleIds }, product: { categoryId: id } },
      include: { product: { select: { title: true } } },
    });

    const byRole = new Map(dto.adjustments.map((a) => [a.roleId, a]));
    const next = rows.map((r) => {
      const a = byRole.get(r.roleId)!;
      const old = Number(r.price);
      const price = Math.round((a.percentage != null ? old * (1 + a.percentage / 100) : old + a.amount!) * 100) / 100;
      return { row: r, price };
    });
    const bad = next.filter((n) => n.price <= 0);
    if (bad.length > 0) {
      const names = [...new Set(bad.map((n) => `${n.row.product.title} (${roleLabel.get(n.row.roleId)})`))];
      throw new BadRequestException(
        `Not saved: this change would bring ${bad.length} price(s) to zero or below (${names.slice(0, 3).join(', ')}${names.length > 3 ? ', …' : ''})`,
      );
    }

    await this.prisma.$transaction(
      next.map((n) => this.prisma.rolePrice.update({ where: { id: n.row.id }, data: { price: n.price } })),
    );
    return {
      updatedCount: next.length,
      productCount: new Set(rows.map((r) => r.productId)).size,
      roleCount: new Set(rows.map((r) => r.roleId)).size,
    };
  }
}
