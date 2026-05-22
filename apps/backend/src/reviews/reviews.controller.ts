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
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get()
  async findAll(@Query('productId') productId?: string) {
    const reviews = await this.reviewsService.findAll(productId);
    return { reviews, count: reviews.length };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const review = await this.reviewsService.findById(id);
    return { review };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateReviewDto, @CurrentUser() user: any) {
    const review = await this.reviewsService.create(user.userId, dto);
    return { review };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user.role === UserRole.ADMIN;
    return this.reviewsService.remove(id, user.userId, isAdmin);
  }
}
