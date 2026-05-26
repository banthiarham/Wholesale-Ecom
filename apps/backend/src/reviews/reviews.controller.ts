import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List all reviews or filter by product' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter reviews by product ID' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter reviews by user ID' })
  async findAll(@Query('productId') productId?: string, @Query('userId') userId?: string) {
    const reviews = await this.reviewsService.findAll(productId, userId);
    return { reviews, count: reviews.length };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single review by ID' })
  @ApiResponse({ status: 200, description: 'Review found' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  async findById(@Param('id') id: string) {
    const review = await this.reviewsService.findById(id);
    return { review };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a product review (authenticated buyers)' })
  @ApiResponse({ status: 201, description: 'Review created' })
  @ApiResponse({ status: 400, description: 'Already reviewed this product' })
  @ApiBody({ type: CreateReviewDto })
  async create(@Body() dto: CreateReviewDto, @CurrentUser() user: any) {
    const review = await this.reviewsService.create(user.userId, dto);
    return { review };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review (owner or Admin)' })
  @ApiResponse({ status: 200, description: 'Review deleted' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete this review' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user.role === UserRole.ADMIN;
    return this.reviewsService.remove(id, user.userId, isAdmin);
  }
}
