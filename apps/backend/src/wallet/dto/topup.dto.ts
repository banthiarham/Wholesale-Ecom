import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class TopupDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Admin top-up' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'order-uuid' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}