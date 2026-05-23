import { Controller, Get, UseGuards, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('for-me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Personalized product recommendations' })
  getForMe(@CurrentUser('id') userId: string, @Query('limit') limit?: string) {
    return this.recommendationsService.getRecommendationsForUser(userId, limit ? parseInt(limit, 10) : 10);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Most popular products' })
  getPopular(@Query('limit') limit?: string) {
    return this.recommendationsService.getPopularProducts(limit ? parseInt(limit, 10) : 10);
  }

  @Get('similar/:productId')
  @ApiOperation({ summary: 'Similar products' })
  getSimilar(@Param('productId') productId: string, @Query('limit') limit?: string) {
    return this.recommendationsService.getSimilarProducts(productId, limit ? parseInt(limit, 10) : 6);
  }
}
