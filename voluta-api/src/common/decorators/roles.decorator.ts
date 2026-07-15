import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Marca um endpoint como restrito a papéis específicos.
 * Uso: @Roles(UserRole.VOLUTA_ADMIN)
 * Sempre combinado com RolesGuard (nunca funciona sozinho).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
