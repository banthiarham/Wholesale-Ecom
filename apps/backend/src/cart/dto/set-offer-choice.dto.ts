import { IsString } from 'class-validator';

export class SetOfferChoiceDto {
  @IsString()
  productId: string;

  /** A dynamic rule id, or "none" to apply no offer to this product. */
  @IsString()
  choice: string;
}
