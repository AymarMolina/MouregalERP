import { SetMetadata } from '@nestjs/common';
import type { RolUsuario } from '@erp/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
