import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export enum OfferType {
  BANK = 'BANK',
  UPI = 'UPI',
}

export enum CardType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  BOTH = 'BOTH',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

export class CreatePaymentOfferDto {
  @IsString()
  name: string;

  @IsEnum(OfferType)
  offerType: OfferType;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsNumber()
  maxDiscount?: number;

  @IsOptional()
  @IsNumber()
  minOrderValue?: number;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  upiApp?: string;

  @IsOptional()
  @IsEnum(CardType)
  cardType?: CardType;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}