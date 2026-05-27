import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ServiceabilityQueryDto {
  @ApiProperty()
  @IsString()
  originPincode: string;

  @ApiProperty()
  @IsString()
  destinationPincode: string;
}