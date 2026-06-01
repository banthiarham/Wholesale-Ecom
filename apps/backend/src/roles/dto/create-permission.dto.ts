import { IsString, IsOptional } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  action: string;

  @IsString()
  resource: string;

  @IsOptional()
  @IsString()
  description?: string;
}