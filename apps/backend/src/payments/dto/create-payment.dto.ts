import { IsString, IsNumber } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  orderId: string;

  @IsString()
  provider: string;

  @IsNumber()
  amount: number;
}
