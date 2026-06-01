import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoyaltyEarningService } from './loyalty-earning.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyReferralDto } from './dto/apply-referral.dto';

@ApiTags('Loyalty')
@Controller('loyalty')
export class LoyaltyEarningController {
  constructor(
    private loyaltyEarningService: LoyaltyEarningService,
    private prisma: PrismaService,
  ) {}

  @Get('rules')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active loyalty earning rules' })
  async getEarningRules() {
    const rules = await this.loyaltyEarningService.getActiveEarningRules();
    return { rules };
  }

  @Get('referral-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my referral code' })
  async getReferralCode(@CurrentUser('id') userId: string) {
    const code = await this.loyaltyEarningService.generateReferralCode(userId);
    return { referralCode: code };
  }

  @Post('apply-referral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply a referral code' })
  async applyReferral(
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyReferralDto,
  ) {
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: dto.code },
    });

    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }

    if (referrer.id === userId) {
      throw new BadRequestException('Cannot use your own referral code');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.referredBy) {
      throw new BadRequestException('Referral code already applied');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { referredBy: dto.code },
    });

    return { success: true, message: 'Referral code applied successfully' };
  }
}