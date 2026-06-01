import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ApplyReferralDto {
  @ApiProperty({ example: 'JOHabc123' })
  @IsString()
  @IsNotEmpty()
  code: string;
}