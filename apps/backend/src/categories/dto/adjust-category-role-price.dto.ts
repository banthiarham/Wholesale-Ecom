import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

// Exactly one of percentage / amount per role (checked in the service). Either may be
// negative to lower prices.
export class RolePriceAdjustmentDto {
  @IsString()
  roleId: string;

  @IsOptional()
  @IsNumber()
  percentage?: number;

  @IsOptional()
  @IsNumber()
  amount?: number;
}

export class AdjustCategoryRolePriceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RolePriceAdjustmentDto)
  adjustments: RolePriceAdjustmentDto[];
}
