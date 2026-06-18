import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBulkRoleDiscountDto } from './dto/create-bulk-role-discount.dto';
import { UpdateBulkRoleDiscountDto } from './dto/update-bulk-role-discount.dto';

@Injectable()
export class BulkRoleDiscountsService {
  constructor(private prisma: PrismaService) {}

  async findAll(isActive?: boolean) {
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive === true;

    return this.prisma.bulkRoleDiscount.findMany({
      where,
      include: {
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
      orderBy: { roleId: 'asc' },
    });
  }

  async findById(id: string) {
    const discount = await this.prisma.bulkRoleDiscount.findUnique({
      where: { id },
      include: {
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
    });
    if (!discount) throw new NotFoundException(`Bulk role discount "${id}" not found`);
    return discount;
  }

  async findByRoleId(roleId: string) {
    return this.prisma.bulkRoleDiscount.findUnique({
      where: { roleId },
      include: {
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
    });
  }

  async findActiveForRoles(roleIds: string[]) {
    return this.prisma.bulkRoleDiscount.findMany({
      where: {
        roleId: { in: roleIds },
        isActive: true,
      },
    });
  }

  async create(dto: CreateBulkRoleDiscountDto) {
    // Verify role exists
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException(`Role "${dto.roleId}" not found`);

    // Check for uniqueness (one discount per role)
    const existing = await this.prisma.bulkRoleDiscount.findUnique({
      where: { roleId: dto.roleId },
    });
    if (existing) {
      throw new ConflictException(
        `A bulk discount already exists for role "${role.label}". Use PUT to update it.`,
      );
    }

    return this.prisma.bulkRoleDiscount.create({
      data: {
        roleId: dto.roleId,
        discountPercent: dto.discountPercent,
        label: dto.label ?? null,
        isActive: dto.isActive ?? true,
      },
      include: {
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
    });
  }

  async update(id: string, dto: UpdateBulkRoleDiscountDto) {
    const existing = await this.prisma.bulkRoleDiscount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Bulk role discount "${id}" not found`);

    return this.prisma.bulkRoleDiscount.update({
      where: { id },
      data: {
        ...(dto.discountPercent !== undefined && { discountPercent: dto.discountPercent }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.bulkRoleDiscount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Bulk role discount "${id}" not found`);
    return this.prisma.bulkRoleDiscount.delete({ where: { id } });
  }
}