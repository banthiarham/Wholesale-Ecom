import { IsString, IsNotEmpty, IsEmail, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CreateBulkOrderDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  contactPerson: string;

  @IsString()
  @IsNotEmpty()
  mobileNumber: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsString()
  @IsNotEmpty()
  businessAddress: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsString()
  @IsNotEmpty()
  products: string;

  @IsString()
  @IsNotEmpty()
  quantity: string;

  @IsString()
  @IsNotEmpty()
  budget: string;

  @IsDateString()
  expectedDeliveryDate: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
