import { Role } from '../../../generated/typeorm/enums';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  fullName: string;
}
