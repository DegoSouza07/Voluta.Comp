import { UserRole } from '../../../common/enums/user-role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  clientId: string | null;
}
