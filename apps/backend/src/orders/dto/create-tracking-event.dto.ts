import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeliveryStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTrackingEventDto {
  @ApiProperty({ enum: DeliveryStatus })
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}