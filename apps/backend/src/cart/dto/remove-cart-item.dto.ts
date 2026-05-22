import { IsString } from 'class-validator';

export class RemoveCartItemDto {
  @IsString()
  itemId: string;
}
