import { IsInt, IsString, IsOptional } from 'class-validator';

export class AdjustStockDto {
  @IsInt()
  adjustment: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
