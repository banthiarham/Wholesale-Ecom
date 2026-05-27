import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class AdjustDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 'Admin balance adjustment' })
  @IsOptional()
  @IsString()
  description?: string;
}