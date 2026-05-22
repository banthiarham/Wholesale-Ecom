import { IsString, IsNumber } from 'class-validator';

export class UpdateCartItemDto {
  @IsString()
  itemId: string;

  @IsNumber()
  quantity: number;
}
