import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { CatalogStatus, UserRole } from '@prisma/client';

@Injectable()
export class CatalogsService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfGeneratorService,
  ) {}

  async create(vendorId: string, dto: any) {
    const catalog = await this.prisma.catalog.create({
      data: {
        name: dto.name,
        description: dto.description,
        vendorId,
        isPublic: dto.isPublic ?? false,
        coverImage: dto.coverImage,
        items: {
          create: (dto.items || []).map((item: any) => ({
            productId: item.productId,
            sortOrder: item.sortOrder || 0,
            customPrice: item.customPrice || null,
            notes: item.notes,
          })),
        },
      },
      include: {
        vendor: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        items: { include: { product: { select: { id: true, title: true, sku: true, unitPrice: true, thumbnail: true, moq: true, tierPrices: true } } } },
      },
    });
    return catalog;
  }

  async findAll(query?: { vendorId?: string; isPublic?: boolean; status?: CatalogStatus }) {
    const where: any = {};
    if (query?.vendorId) where.vendorId = query.vendorId;
    if (query?.isPublic !== undefined) where.isPublic = query.isPublic;
    if (query?.status) where.status = query.status;

    return this.prisma.catalog.findMany({
      where,
      include: {
        vendor: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId?: string, role?: UserRole) {
    const catalog = await this.prisma.catalog.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        items: {
          include: { product: { select: { id: true, title: true, sku: true, unitPrice: true, thumbnail: true, moq: true, tierPrices: true, description: true, vendorName: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!catalog) throw new NotFoundException('Catalog not found');
    if (!catalog.isPublic && role !== UserRole.ADMIN && catalog.vendorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return catalog;
  }

  async update(id: string, dto: any, userId: string, role: UserRole) {
    const catalog = await this.findById(id, userId, role);
    if (role !== UserRole.ADMIN && catalog.vendorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.catalog.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic,
        coverImage: dto.coverImage,
        status: dto.status,
      },
      include: {
        vendor: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        items: { include: { product: { select: { id: true, title: true, sku: true, unitPrice: true, thumbnail: true, moq: true, tierPrices: true } } } },
      },
    });
  }

  async delete(id: string, userId: string, role: UserRole) {
    const catalog = await this.findById(id, userId, role);
    if (role !== UserRole.ADMIN && catalog.vendorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.catalog.delete({ where: { id } });
    return { deleted: true };
  }

  async addItem(catalogId: string, productId: string, sortOrder?: number, customPrice?: number, notes?: string) {
    return this.prisma.catalogItem.create({
      data: { catalogId, productId, sortOrder: sortOrder || 0, customPrice: customPrice || null, notes },
      include: { product: { select: { id: true, title: true, sku: true, unitPrice: true, thumbnail: true, moq: true } } },
    });
  }

  async removeItem(catalogId: string, itemId: string) {
    return this.prisma.catalogItem.delete({
      where: { id: itemId },
    });
  }

  async generatePdf(id: string, userId: string, role: UserRole) {
    const catalog = await this.findById(id, userId, role);
    if (role !== UserRole.ADMIN && catalog.vendorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const filePath = await this.pdfService.generateCatalogPdf(catalog);
    const pdfUrl = this.pdfService.getPdfUrl(catalog.id);

    await this.prisma.catalog.update({
      where: { id },
      data: { pdfUrl },
    });

    return { pdfUrl, filePath };
  }
}
