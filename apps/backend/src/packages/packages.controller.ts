import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  CreatePackageTemplateDto,
  UpdatePackageTemplateDto,
  AddPackageToCartDto,
  CalculatePackagePriceDto,
} from './dto/package.dto';

@ApiTags('Packages')
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  // ── Static routes BEFORE parameterized routes ──

  @Get()
  @ApiOperation({ summary: 'List package templates' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (DRAFT, PUBLISHED, ARCHIVED)' })
  async findAll(@Query('status') status?: string) {
    const packages = await this.packagesService.findAll(status);
    return { packages };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a package template (Admin only)' })
  async create(@Body() dto: CreatePackageTemplateDto) {
    const pkg = await this.packagesService.create(dto);
    return { package: pkg };
  }

  @Post('price')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate package price for given selections' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Guest session identifier' })
  async calculatePrice(@Body() dto: CalculatePackagePriceDto, @Req() req: any) {
    const userId = req.user?.id;
    return this.packagesService.calculatePackagePrice(dto.packageId, dto.selections, userId);
  }

  @Post('cart')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a configured package to cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Guest session identifier' })
  async addToCart(@Body() dto: AddPackageToCartDto, @Req() req: any) {
    const userId = req.user?.id;
    const sessionId = dto.sessionId || req.headers['x-session-id'] as string;
    return this.packagesService.addPackageToCart(dto, userId, sessionId);
  }

  // ── Parameterized routes ──

  @Get(':handle')
  @ApiOperation({ summary: 'Get package template by handle' })
  async findByHandle(@Param('handle') handle: string) {
    const pkg = await this.packagesService.findByHandle(handle);
    return { package: pkg };
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'Get package template by ID' })
  async findById(@Param('id') id: string) {
    const pkg = await this.packagesService.findById(id);
    return { package: pkg };
  }

  @Get(':id/groups/:groupId/products')
  @ApiOperation({ summary: 'Get available products for a package group' })
  async getGroupProducts(@Param('groupId') groupId: string) {
    return this.packagesService.getGroupProducts(groupId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a package template (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdatePackageTemplateDto) {
    const pkg = await this.packagesService.update(id, dto);
    return { package: pkg };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a package template (Admin only)' })
  async remove(@Param('id') id: string) {
    return this.packagesService.remove(id);
  }
}