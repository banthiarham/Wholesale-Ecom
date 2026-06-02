import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomeSectionDto } from './dto/create-home-section.dto';
import { UpdateHomeSectionDto } from './dto/update-home-section.dto';

@Injectable()
export class HomeSectionsService {
  constructor(private prisma: PrismaService) {}

  async findActive() {
    return this.prisma.homeSection.findMany({
      where: { isActive: true },
      include: { category: { select: { id: true, name: true, handle: true, image: true } } },
      orderBy: { rank: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.homeSection.findMany({
      include: { category: { select: { id: true, name: true, handle: true, image: true } } },
      orderBy: { rank: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.homeSection.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, handle: true, image: true } } },
    });
  }

  async create(dto: CreateHomeSectionDto) {
    const data: any = { ...dto };
    if (data.config && typeof data.config === 'object') {
      data.config = JSON.stringify(data.config);
    }
    return this.prisma.homeSection.create({
      data,
      include: { category: { select: { id: true, name: true, handle: true, image: true } } },
    });
  }

  async update(id: string, dto: UpdateHomeSectionDto) {
    const data: any = { ...dto };
    if (data.config && typeof data.config === 'object') {
      data.config = JSON.stringify(data.config);
    }
    return this.prisma.homeSection.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true, handle: true, image: true } } },
    });
  }

  async remove(id: string) {
    return this.prisma.homeSection.delete({ where: { id } });
  }

  async reorder(ids: string[]) {
    return this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.homeSection.update({
          where: { id },
          data: { rank: index },
        }),
      ),
    );
  }
}