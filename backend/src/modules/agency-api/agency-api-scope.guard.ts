import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../../common/errors';
import type { AgencyApiScope } from '../../../generated/typeorm/enums';

export const AGENCY_API_SCOPES_KEY = 'agencyApiScopes';

/** Minimum scope required for the route (FULL satisfies any requirement). */
export const RequireAgencyApiScope = (...scopes: AgencyApiScope[]) =>
  SetMetadata(AGENCY_API_SCOPES_KEY, scopes);

const SCOPE_RANK: Record<AgencyApiScope, number> = {
  SEARCH_ONLY: 1,
  SEARCH_BOOK: 2,
  FULL: 3,
};

@Injectable()
export class AgencyApiScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<AgencyApiScope[]>(
        AGENCY_API_SCOPES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const keyScope = request.agencyApiKey?.scope as AgencyApiScope | undefined;
    if (!keyScope) return false;

    const keyRank = SCOPE_RANK[keyScope];
    const minRequired = Math.min(...required.map((s) => SCOPE_RANK[s]));
    if (keyRank < minRequired) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'دامنه کلید API برای این عملیات کافی نیست.',
      });
    }
    return true;
  }
}
