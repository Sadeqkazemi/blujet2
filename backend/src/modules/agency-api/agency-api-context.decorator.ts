import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AgencyApiRequestContext } from './agency-api-key.guard';

export const AgencyApiContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AgencyApiRequestContext => {
    const request = ctx.switchToHttp().getRequest();
    return {
      agencyApiKey: request.agencyApiKey,
      agencyProfile: request.agencyProfile,
      agencyUser: request.agencyUser,
    };
  },
);
