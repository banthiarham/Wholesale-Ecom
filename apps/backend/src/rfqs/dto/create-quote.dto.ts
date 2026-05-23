import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class CreateQuoteItemDto {
  @IsString()
  rfqItemId: string;

  @IsNumber()
  @Type(() => Number)
  unitPrice: number;

  @IsInt()
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalPrice?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  leadTimeDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateQuoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items: CreateQuoteItemDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  terms?: string;
}
