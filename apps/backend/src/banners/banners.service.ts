import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannersService {
  constructor(private prisma: PrismaService) {}

  async findActive(section?: string) {
    const where: any = { isActive: true };
    if (section) where.section = section;

    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        ...where,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
        ],
      },
      orderBy: { rank: 'asc' },
    });
  }

  async findAll(section?: string) {
    const where: any = {};
    if (section) where.section = section;
    return this.prisma.banner.findMany({
      where,
      orderBy: { rank: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.banner.findUnique({ where: { id } });
  }

  async create(dto: CreateBannerDto) {
    return this.prisma.banner.create({ data: dto as any });
  }

  async update(id: string, dto: UpdateBannerDto) {
    return this.prisma.banner.update({ where: { id }, data: dto as any });
  }

  async remove(id: string) {
    return this.prisma.banner.delete({ where: { id } });
  }

  async reorder(ids: string[]) {
    return this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.banner.update({
          where: { id },
          data: { rank: index },
        }),
      ),
    );
  }
}