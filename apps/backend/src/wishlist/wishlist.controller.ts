import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Wishlist')
@Controller('wishlist')
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user's wishlist" })
  async findAll(@CurrentUser() user: any) {
    const items = await this.wishlistService.findByUser(user.userId);
    return { items };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add product to wishlist' })
  async add(@CurrentUser() user: any, @Body() body: { productId: string }) {
    const item = await this.wishlistService.add(user.userId, body.productId);
    return { item };
  }

  @Delete(':productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove product from wishlist' })
  async remove(@CurrentUser() user: any, @Param('productId') productId: string) {
    await this.wishlistService.remove(user.userId, productId);
    return { success: true };
  }
}