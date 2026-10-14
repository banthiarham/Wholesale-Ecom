import { IsString, IsOptional, IsNumber, IsInt, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  title: string;

  @IsString()
  handle: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsInt()
  moq: number;

  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  compareAtPrice?: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsInt()
  inventoryQuantity: number;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  companyName?: string | null;

  @IsOptional()
  @IsNumber()
  sizeGb?: number | null;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  // Every category the product is listed under. The first one becomes the primary categoryId.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  tierPrices?: { minQty: number; maxQty?: number | null; price: number }[];

  // Variants (see ProductsService.saveVariants for the full validation).
  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;

  /** [{ name: "Color", values: ["Black", "Blue"] }] */
  @IsOptional()
  @IsArray()
  variantOptions?: { name: string; values: string[] }[];

  /** [{ id?, options: { Color: "Black" }, sku, price, inventoryQuantity, image?, isActive? }] */
  @IsOptional()
  @IsArray()
  variants?: {
    id?: string;
    options: Record<string, string>;
    sku: string;
    price: number;
    inventoryQuantity: number;
    images?: string[];
    image?: string | null;
    isActive?: boolean;
  }[];
}
