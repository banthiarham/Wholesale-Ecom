import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// Accepts role name strings — works with both dynamic roles and legacy UserRole enum values
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);