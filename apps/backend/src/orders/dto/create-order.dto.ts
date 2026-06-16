import { IsString, IsOptional, ValidateNested, IsEmail, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+?[\d\s-]{7,15}$/, { message: 'Enter a valid phone number' })
  phone: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  street: string;

  @ApiPropertyOptional({ example: 'Apt 4B, Building 5' })
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiPropertyOptional({ example: 'Near City Mall' })
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiProperty({ example: 'Mumbai' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  state: string;

  @ApiProperty({ example: '400001' })
  @IsString()
  zip: string;

  @ApiProperty({ example: 'India' })
  @IsString()
  country: string;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  cartId: string;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  couponCode?: string;
}