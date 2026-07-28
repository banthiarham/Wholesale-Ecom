import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateRefundDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
