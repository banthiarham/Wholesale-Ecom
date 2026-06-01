import { IsString, IsOptional } from 'class-validator';

export class CreateRoleRequestDto {
  @IsString()
  roleId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}