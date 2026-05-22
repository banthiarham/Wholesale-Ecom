import { IsString, IsEnum } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class VerifyPaymentDto {
  @IsString()
  providerRef: string;

  @IsEnum(PaymentStatus)
  status: PaymentStatus;
}
