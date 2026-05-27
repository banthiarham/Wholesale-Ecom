import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SyncTrackingDto {
  @ApiProperty()
  @IsString()
  orderId: string;
}