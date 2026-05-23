import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, CatalogStatus } from '@prisma/client';
import * as fs from 'fs';

@ApiTags('Catalogs')
@Controller('catalogs')
export class CatalogsController {
  constructor(private catalogsService: CatalogsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a catalog' })
  @ApiBody({ type: CreateCatalogDto })
  async create(@Body() dto: CreateCatalogDto, @CurrentUser('id') userId: string) {
    return this.catalogsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List catalogs (public or by vendor)' })
  @ApiQuery({ name: 'vendorId', required: false })
  @ApiQuery({ name: 'isPublic', required: false })
  @ApiQuery({ name: 'status', enum: CatalogStatus, required: false })
  async findAll(
    @Query('vendorId') vendorId?: string,
    @Query('isPublic') isPublic?: string,
    @Query('status') status?: CatalogStatus,
  ) {
    return this.catalogsService.findAll({
      vendorId,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get catalog detail' })
  @ApiParam({ name: 'id', description: 'Catalog UUID' })
  async findById(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.catalogsService.findById(id, user?.userId, user?.role);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update catalog' })
  @ApiParam({ name: 'id', description: 'Catalog UUID' })
  @ApiBody({ type: UpdateCatalogDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.catalogsService.update(id, dto, userId, role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete catalog' })
  @ApiParam({ name: 'id', description: 'Catalog UUID' })
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.catalogsService.delete(id, userId, role);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add product to catalog' })
  @ApiParam({ name: 'id', description: 'Catalog UUID' })
  async addItem(
    @Param('id') id: string,
    @Body() body: { productId: string; sortOrder?: number; customPrice?: number; notes?: string },
  ) {
    return this.catalogsService.addItem(id, body.productId, body.sortOrder, body.customPrice, body.notes);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove product from catalog' })
  @ApiParam({ name: 'id', description: 'Catalog UUID' })
  @ApiParam({ name: 'itemId', description: 'CatalogItem UUID' })
  async removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.catalogsService.removeItem(id, itemId);
  }

  @Post(':id/generate-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate PDF catalog' })
  @ApiParam({ name: 'id', description: 'Catalog UUID' })
  async generatePdf(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.catalogsService.generatePdf(id, userId, role);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download generated PDF' })
  @ApiParam({ name: 'id', description: 'Catalog UUID' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const catalog = await this.catalogsService.findById(id);
    if (!catalog.pdfUrl) {
      return res.status(404).json({ message: 'PDF not generated yet' });
    }
    const filePath = catalog.pdfUrl.replace('/uploads/', 'uploads/');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'PDF file not found' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${catalog.name}.pdf"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
