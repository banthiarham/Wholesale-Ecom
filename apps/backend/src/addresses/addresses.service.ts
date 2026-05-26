import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, data: { label?: string; street: string; city: string; state: string; zip: string; country?: string; isDefault?: boolean }) {
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        userId,
        label: data.label,
        street: data.street,
        city: data.city,
        state: data.state,
        zip: data.zip,
        country: data.country || 'India',
        isDefault: data.isDefault || false,
      },
    });
  }

  async update(id: string, userId: string, data: { label?: string; street?: string; city?: string; state?: string; zip?: string; country?: string; isDefault?: boolean }) {
    const addr = await this.prisma.address.findUnique({ where: { id } });
    if (!addr || addr.userId !== userId) throw new NotFoundException('Address not found');

    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, userId: string) {
    const addr = await this.prisma.address.findUnique({ where: { id } });
    if (!addr || addr.userId !== userId) throw new NotFoundException('Address not found');

    return this.prisma.address.delete({ where: { id } });
  }

  async setDefault(id: string, userId: string) {
    const addr = await this.prisma.address.findUnique({ where: { id } });
    if (!addr || addr.userId !== userId) throw new NotFoundException('Address not found');

    await this.prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    return this.prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });
  }
}