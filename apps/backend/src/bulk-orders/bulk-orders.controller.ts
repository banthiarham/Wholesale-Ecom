import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { BulkOrdersService } from './bulk-orders.service';
import { CreateBulkOrderDto } from './dto/create-bulk-order.dto';
import { UpdateBulkOrderStatusDto } from './dto/update-bulk-order-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, BulkOrderStatus } from '@prisma/client';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
]);

@ApiTags('Bulk Orders')
@Controller('bulk-orders')
export class BulkOrdersController {
  constructor(private bulkOrdersService: BulkOrdersService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit a bulk order (quote) request — guests allowed' })
  @ApiResponse({ status: 201, description: 'Bulk order request submitted' })
  @UseInterceptors(
    FileInterceptor('attachment', {
      storage: diskStorage({
        destination: (req: any, file: any, cb: any) => {
          cb(null, join(process.cwd(), 'uploads', 'bulk-orders'));
        },
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
      fileFilter: (req: any, file: any, cb: any) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          cb(new BadRequestException('Unsupported file type. Allowed: PDF, DOC(X), XLS(X), JPG, PNG'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @Body() dto: CreateBulkOrderDto,
    @CurrentUser() user: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const attachmentUrl = file ? `/uploads/bulk-orders/${file.filename}` : undefined;
    const bulkOrder = await this.bulkOrdersService.create(dto, user?.id || null, attachmentUrl);
    return { bulkOrder };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all bulk order requests (Admin)' })
  @ApiQuery({ name: 'status', enum: BulkOrderStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Bulk order requests retrieved' })
  async findAll(@Query('status') status?: BulkOrderStatus, @Query('search') search?: string) {
    const bulkOrders = await this.bulkOrdersService.findAll(status, search);
    return { bulkOrders };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bulk order request details (Admin)' })
  @ApiParam({ name: 'id', description: 'Bulk order request UUID' })
  @ApiResponse({ status: 200, description: 'Bulk order request found' })
  @ApiResponse({ status: 404, description: 'Bulk order request not found' })
  async findById(@Param('id') id: string) {
    const bulkOrder = await this.bulkOrdersService.findById(id);
    return { bulkOrder };
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update bulk order request status (Admin)' })
  @ApiParam({ name: 'id', description: 'Bulk order request UUID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateStatus(@Param('id') id: string, @Body() body: UpdateBulkOrderStatusDto) {
    const bulkOrder = await this.bulkOrdersService.updateStatus(id, body.status);
    return { bulkOrder };
  }
}
