import { Role } from '../../../generated/prisma/enums';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  fullName: string;
}
