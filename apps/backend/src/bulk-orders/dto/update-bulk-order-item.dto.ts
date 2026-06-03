import { IsInt, Min } from 'class-validator';

export class UpdateBulkOrderItemDto {
  @IsInt()
  @Min(1)
  quantity: number;
}