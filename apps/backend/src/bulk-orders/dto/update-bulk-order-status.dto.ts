import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BulkOrderStatus } from '@prisma/client';

export class UpdateBulkOrderStatusDto {
  @ApiProperty({ enum: BulkOrderStatus })
  @IsEnum(BulkOrderStatus)
  status: BulkOrderStatus;
}