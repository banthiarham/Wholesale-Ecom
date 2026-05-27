import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeliveryPartnersService {
  constructor(private prisma: PrismaService) {}

  async findAll(activeOnly = false) {
    return this.prisma.deliveryPartner.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
      include: { _count: { select: { orders: true } } },
    });
  }

  async findById(id: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return partner;
  }

  async create(data: {
    name: string;
    code: string;
    trackingUrlTemplate?: string;
    contactEmail?: string;
    contactPhone?: string;
    logo?: string;
    isActive?: boolean;
  }) {
    return this.prisma.deliveryPartner.create({ data });
  }

  async update(id: string, data: {
    name?: string;
    code?: string;
    trackingUrlTemplate?: string;
    contactEmail?: string;
    contactPhone?: string;
    logo?: string;
    isActive?: boolean;
  }) {
    await this.findById(id);
    return this.prisma.deliveryPartner.update({ where: { id }, data });
  }

  async remove(id: string) {
    const partner = await this.findById(id);
    const orderCount = await this.prisma.order.count({ where: { deliveryPartnerId: id } });
    if (orderCount > 0) {
      return this.prisma.deliveryPartner.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.deliveryPartner.delete({ where: { id } });
  }

  async getStats() {
    const [total, active, byOrderCount] = await Promise.all([
      this.prisma.deliveryPartner.count(),
      this.prisma.deliveryPartner.count({ where: { isActive: true } }),
      this.prisma.deliveryPartner.findMany({
        select: { id: true, name: true, _count: { select: { orders: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { total, active, partners: byOrderCount };
  }
}