import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class DeductDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 200 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Order payment deduction' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'order-uuid' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}