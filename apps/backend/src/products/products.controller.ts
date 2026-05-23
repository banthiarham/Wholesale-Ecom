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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import { diskStorage } from 'multer';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all published products with optional filters' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query (title, description, SKU)' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category ID' })
  @ApiQuery({ name: 'vendor', required: false, description: 'Filter by vendor ID' })
  @ApiQuery({ name: 'min_price', required: false, description: 'Minimum price filter', type: Number })
  @ApiQuery({ name: 'max_price', required: false, description: 'Maximum price filter', type: Number })
  @ApiQuery({ name: 'in_stock', required: false, description: 'Filter in-stock items only', type: Boolean })
  @ApiQuery({ name: 'tags', required: false, description: 'Comma-separated tags' })
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
  @ApiOperation({ summary: 'Get a single product by its handle (slug)' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiParam({ name: 'handle', description: 'Product handle (URL-friendly slug)' })
  async findByHandle(@Param('handle') handle: string) {
    const product = await this.productsService.findByHandle(handle);
    return { product };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product (Admin / Vendor)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiBody({ type: CreateProductDto })
  async create(@Body() dto: CreateProductDto) {
    const product = await this.productsService.create(dto);
    return { product };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing product (Admin / Vendor)' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiBody({ type: UpdateProductDto })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const product = await this.productsService.update(id, dto);
    return { product };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product (Admin only)' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return { success: true };
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload product images (Admin / Vendor)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'products');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
          cb(null, unique);
        },
      }),
    }),
  )
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const urls = files.map((f) => `/uploads/products/${f.filename}`);
    const product = await this.productsService.addImages(id, urls);
    return { product, uploaded: urls };
  }
}
