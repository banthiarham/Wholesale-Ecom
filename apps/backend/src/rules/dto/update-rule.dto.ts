import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean, IsInt, IsObject, Min } from 'class-validator';
import { DynamicRuleType } from '@prisma/client';

export class UpdateRuleDto {
  @ApiPropertyOptional({ example: 'Summer Sale 20% Off' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: DynamicRuleType })
  @IsOptional()
  @IsEnum(DynamicRuleType)
  type?: DynamicRuleType;

  @ApiPropertyOptional({ example: 'Applies to all electronics' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: { productIds: [], categoryIds: [] } })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  @ApiPropertyOptional({ example: { discountType: 'PERCENTAGE', discountValue: 20 } })
  @IsOptional()
  @IsObject()
  actions?: Record<string, any>;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00Z' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsString()
  endDate?: string;
}