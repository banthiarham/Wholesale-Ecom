import { IsNumber, Min, Max } from 'class-validator';

export class AdjustCategoryPriceDto {
  @IsNumber()
  @Min(-99)
  @Max(1000)
  percentage: number;
}
