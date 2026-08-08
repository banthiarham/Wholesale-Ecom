import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BulkOrderStatus } from '@prisma/client';

export class UpdateBulkOrderStatusDto {
  @ApiProperty({ enum: BulkOrderStatus })
  @IsEnum(BulkOrderStatus)
  status: BulkOrderStatus;

  @ApiPropertyOptional({ description: 'Admin note explaining the decision, shown to the buyer' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
