import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('q') search?: string,
    @Query('category') categoryId?: string,
    @Query('vendor') vendorId?: string,
    @Query('min_price') minPrice?: string,
    @Query('max_price') maxPrice?: string,
    @Query('in_stock') inStock?: string,
    @Query('tags') tags?: string,
  ) {
    const filters: any = {};
    if (search) filters.search = search;
    if (categoryId) filters.categoryId = categoryId;
    if (vendorId) filters.vendorId = vendorId;
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (inStock === 'true') filters.inStock = true;
    if (tags) filters.tags = tags.split(',');

    const products = await this.productsService.findAll(filters);
    return { products, count: products.length };
  }

  @Get(':handle')
  async findByHandle(@Param('handle') handle: string) {
    const product = await this.productsService.findByHandle(handle);
    return { product };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  async create(@Body() data: any) {
    const product = await this.productsService.create(data);
    return { product };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  async update(@Param('id') id: string, @Body() data: any) {
    const product = await this.productsService.update(id, data);
    return { product };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return { success: true };
  }
}
